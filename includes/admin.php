<?php
/**
 * Page Annotator - Admin editor enqueue + Gutenberg button.
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get theme color palette for the annotation editor.
 */
function pa_get_theme_colors() {
	if ( function_exists( 'wp_get_global_settings' ) ) {
		$settings = wp_get_global_settings();
		if ( ! empty( $settings['color']['palette']['theme'] ) ) {
			return array_map( function ( $c ) {
				return array(
					'name'  => $c['name'],
					'color' => $c['color'],
					'slug'  => $c['slug'],
				);
			}, $settings['color']['palette']['theme'] );
		}
	}
	return array();
}

// ─── Frontend: carica l'editor React solo con ?annotation=true ───────────────
add_action( 'wp_enqueue_scripts', function () {
	if ( is_admin() ) {
		return;
	}

	$view_key = is_singular() ? '' : pa_resolve_view_key();
	if ( ! is_singular() && ! $view_key ) {
		return;
	}

	// L'editor si attiva SOLO con il parametro annotation=true + permessi
	if ( empty( $_GET['annotation'] ) || $_GET['annotation'] !== 'true' ) {
		return;
	}

	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	$asset_file = PA_PATH . 'editor/build/index.asset.php';
	if ( ! file_exists( $asset_file ) ) {
		return;
	}
	$asset = require $asset_file;

	wp_enqueue_script(
		'page-annotator-editor',
		PA_URL . 'editor/build/index.js',
		$asset['dependencies'],
		$asset['version'],
		true
	);

	if ( file_exists( PA_PATH . 'editor/build/index.css' ) ) {
		wp_enqueue_style(
			'page-annotator-editor',
			PA_URL . 'editor/build/index.css',
			array(),
			$asset['version']
		);
	}

	wp_localize_script( 'page-annotator-editor', 'pageAnnotator', array(
		'nonce'        => wp_create_nonce( 'wp_rest' ),
		'restUrl'      => rest_url( 'page-annotator/' ),
		'target'       => $view_key ? 'view' : 'post',
		'postId'       => $view_key ? 0 : get_the_ID(),
		'viewKey'      => $view_key,
		'pageUrl'      => $view_key ? pa_current_view_url() : get_permalink(),
		'themeColors'  => pa_get_theme_colors(),
		'strokeWidths' => pa_get_stroke_width_steps(),
	) );

	// Nascondi overlay frontend quando l'editor e attivo
	remove_action( 'wp_footer', 'pa_render_overlay' );
} );

// ─── Editor shell: con ?annotation=true servi una pagina vuota ───────────────
// La pagina reale viene caricata dall'editor dentro un iframe (preview mode),
// quindi qui il template del tema non deve renderizzare il proprio contenuto.
function pa_is_editor_request() {
	if ( is_admin() || empty( $_GET['annotation'] ) || $_GET['annotation'] !== 'true' ) {
		return false;
	}
	if ( ! current_user_can( 'edit_posts' ) ) {
		return false;
	}
	return is_singular() || (bool) pa_resolve_view_key();
}

add_filter( 'template_include', function ( $template ) {
	if ( ! pa_is_editor_request() ) {
		return $template;
	}
	$shell = PA_PATH . 'editor/shell.php';
	return file_exists( $shell ) ? $shell : $template;
}, 999 );

add_action( 'template_redirect', function () {
	if ( pa_is_editor_request() ) {
		add_filter( 'show_admin_bar', '__return_false' );
	}
} );

// ─── Gutenberg: bottone "Aggiungi annotazioni" nel pannello post ─────────────
add_action( 'enqueue_block_editor_assets', function () {
	global $post;
	if ( ! $post || ! is_object( $post ) ) {
		return;
	}

	// Solo per post types pubblici
	$post_type_obj = get_post_type_object( $post->post_type );
	if ( ! $post_type_obj || ! $post_type_obj->public ) {
		return;
	}

	wp_enqueue_script(
		'page-annotator-gutenberg-button',
		PA_URL . 'assets/js/gutenberg-button.js',
		array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-data', 'wp-components' ),
		PA_VERSION,
		true
	);
} );

// ─── Preview iframe: nascondi admin bar e overlay ────────────────────────────
add_action( 'template_redirect', function () {
	if ( ! isset( $_GET['page_annotator_preview'] ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}

	add_filter( 'show_admin_bar', '__return_false' );
	remove_action( 'wp_footer', 'pa_render_overlay' );

	add_action( 'wp_enqueue_scripts', function () {
		wp_dequeue_script( 'page-annotator-editor' );
		wp_dequeue_style( 'page-annotator-editor' );
	}, 100 );
} );
