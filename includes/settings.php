<?php
/**
 * Page Annotator - Global settings page.
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'admin_menu', function () {
	add_options_page(
		__( 'Page Annotator', 'page-annotator' ),
		__( 'Page Annotator', 'page-annotator' ),
		'manage_options',
		'page-annotator',
		'pa_render_settings_page'
	);
} );

add_action( 'admin_init', function () {
	register_setting( 'page_annotator', 'page_annotator_settings', array(
		'type'              => 'array',
		'default'           => array(
			'animation_style'   => 'smooth',
			'animation_timing'  => 'sequential',
			'scroll_reverse'    => false,
			'stroke_widths'     => '2, 4, 8, 12, 20',
		),
		'sanitize_callback' => 'pa_sanitize_settings',
	) );

	// ─── Animation section ────────────────────────────────────────
	add_settings_section(
		'pa_animation_section',
		__( 'Animation', 'page-annotator' ),
		'__return_null',
		'page-annotator'
	);

	add_settings_field( 'pa_animation_style', __( 'Style', 'page-annotator' ), 'pa_field_animation_style', 'page-annotator', 'pa_animation_section' );
	add_settings_field( 'pa_animation_timing', __( 'Timing', 'page-annotator' ), 'pa_field_animation_timing', 'page-annotator', 'pa_animation_section' );
	add_settings_field( 'pa_scroll_reverse', __( 'Reverse on scroll', 'page-annotator' ), 'pa_field_scroll_reverse', 'page-annotator', 'pa_animation_section' );

	// ─── Editor section ───────────────────────────────────────────
	add_settings_section(
		'pa_editor_section',
		__( 'Editor', 'page-annotator' ),
		'__return_null',
		'page-annotator'
	);

	add_settings_field( 'pa_stroke_widths', __( 'Stroke widths', 'page-annotator' ), 'pa_field_stroke_widths', 'page-annotator', 'pa_editor_section' );
} );

function pa_sanitize_settings( $input ) {
	$valid_styles  = array( 'none', 'smooth', 'stepped', 'fast', 'elastic', 'rough' );
	$valid_timings = array( 'sequential', 'simultaneous' );

	return array(
		'animation_style'  => in_array( $input['animation_style'] ?? '', $valid_styles, true )
			? $input['animation_style']
			: 'smooth',
		'animation_timing' => in_array( $input['animation_timing'] ?? '', $valid_timings, true )
			? $input['animation_timing']
			: 'sequential',
		'scroll_reverse'   => ! empty( $input['scroll_reverse'] ),
		'stroke_widths'    => sanitize_text_field( $input['stroke_widths'] ?? '2, 4, 8, 12, 20' ),
	);
}

function pa_get_settings() {
	return wp_parse_args(
		get_option( 'page_annotator_settings', array() ),
		array(
			'animation_style'  => 'smooth',
			'animation_timing' => 'sequential',
			'scroll_reverse'   => false,
			'stroke_widths'    => '2, 4, 8, 12, 20',
		)
	);
}

/**
 * Parse stroke widths string into an array of { value, label } objects.
 * Accepts: "2, 4, 8, 0.5rem, 1rem" → [{ value: '2', label: '2' }, ...]
 */
function pa_get_stroke_width_steps() {
	$settings = pa_get_settings();
	$raw      = $settings['stroke_widths'] ?? '2, 4, 8, 12, 20';
	$steps    = array_filter( array_map( 'trim', explode( ',', $raw ) ) );

	return array_values( array_map( function ( $s ) {
		return array( 'value' => $s, 'label' => $s );
	}, $steps ) );
}

// ─── Field renderers ──────────────────────────────────────────────

function pa_field_animation_style() {
	$settings = pa_get_settings();
	$current  = $settings['animation_style'];

	$styles = array(
		'none'    => array( 'label' => 'None',    'desc' => 'Nessuna animazione, tratti visibili subito.' ),
		'smooth'  => array( 'label' => 'Smooth',  'desc' => 'Fluida, ease classico.' ),
		'stepped' => array( 'label' => 'Stepped', 'desc' => 'A scatti, effetto frame-by-frame.' ),
		'fast'    => array( 'label' => 'Fast',    'desc' => 'Rapida e decisa, tratto veloce.' ),
		'elastic' => array( 'label' => 'Elastic', 'desc' => 'Rimbalzo elastico alla fine.' ),
		'rough'   => array( 'label' => 'Rough',   'desc' => 'Irregolare, effetto disegnato a mano.' ),
	);

	echo '<fieldset>';
	foreach ( $styles as $value => $style ) {
		printf(
			'<label style="display:block;margin-bottom:6px;">
				<input type="radio" name="page_annotator_settings[animation_style]" value="%s" %s />
				<strong>%s</strong> &mdash; <span style="color:#666;">%s</span>
			</label>',
			esc_attr( $value ),
			checked( $current, $value, false ),
			esc_html( $style['label'] ),
			esc_html( $style['desc'] )
		);
	}
	echo '</fieldset>';
}

function pa_field_animation_timing() {
	$settings = pa_get_settings();
	$current  = $settings['animation_timing'];

	$timings = array(
		'sequential'   => array( 'label' => 'Sequential',   'desc' => 'Un tratto dopo l\'altro, in ordine.' ),
		'simultaneous' => array( 'label' => 'Simultaneous', 'desc' => 'Tutti i tratti partono insieme.' ),
	);

	echo '<fieldset>';
	foreach ( $timings as $value => $timing ) {
		printf(
			'<label style="display:block;margin-bottom:6px;">
				<input type="radio" name="page_annotator_settings[animation_timing]" value="%s" %s />
				<strong>%s</strong> &mdash; <span style="color:#666;">%s</span>
			</label>',
			esc_attr( $value ),
			checked( $current, $value, false ),
			esc_html( $timing['label'] ),
			esc_html( $timing['desc'] )
		);
	}
	echo '</fieldset>';
}

function pa_field_scroll_reverse() {
	$settings = pa_get_settings();
	printf(
		'<label>
			<input type="checkbox" name="page_annotator_settings[scroll_reverse]" value="1" %s />
			%s
		</label>
		<p class="description">%s</p>',
		checked( $settings['scroll_reverse'], true, false ),
		esc_html__( 'Inverti animazione quando si esce dal viewport', 'page-annotator' ),
		esc_html__( 'Le annotazioni si cancellano quando scorri via e si ridisegnano quando torni.', 'page-annotator' )
	);
}

function pa_field_stroke_widths() {
	$settings = pa_get_settings();
	printf(
		'<input type="text" name="page_annotator_settings[stroke_widths]" value="%s" class="regular-text" />
		<p class="description">%s</p>',
		esc_attr( $settings['stroke_widths'] ),
		esc_html__( 'Valori separati da virgola. Accetta qualsiasi unità (px, rem, ecc.). Es: 2, 4, 8, 0.5rem, 1rem', 'page-annotator' )
	);
}

function pa_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Page Annotator', 'page-annotator' ); ?></h1>
		<form method="post" action="options.php">
			<?php
			settings_fields( 'page_annotator' );
			do_settings_sections( 'page-annotator' );
			submit_button();
			?>
		</form>
	</div>
	<?php
}
