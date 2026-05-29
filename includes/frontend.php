<?php
/**
 * Page Annotator - Frontend slot-based rendering.
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function pa_get_overlay_data() {
	if ( is_singular() ) {
		$svg_json = get_post_meta( get_the_ID(), '_page_annotator_svg', true );
		if ( empty( $svg_json ) ) {
			return null;
		}
		return pa_normalize_svg_data( json_decode( $svg_json, true ) );
	}

	$key = pa_resolve_view_key();
	if ( ! $key ) {
		return null;
	}
	$record = pa_get_view_record( $key );
	if ( ! $record || empty( $record['svg'] ) ) {
		return null;
	}
	return pa_normalize_svg_data( $record['svg'] );
}

add_filter( 'body_class', function ( $classes ) {
	$data = pa_get_overlay_data();
	if ( $data && pa_svg_data_has_any( $data ) ) {
		$classes[] = 'has-page-annotations';
	}
	return $classes;
} );

function pa_render_overlay() {
	$data = pa_get_overlay_data();
	if ( ! $data || ! pa_svg_data_has_any( $data ) ) {
		return;
	}

	wp_enqueue_style(
		'page-annotator-frontend',
		PA_URL . 'assets/css/frontend.css',
		array(),
		PA_VERSION
	);

	wp_register_script( 'gsap', 'https://cdn.jsdelivr.net/npm/gsap@3.12/dist/gsap.min.js', array(), '3.12', true );
	wp_register_script( 'gsap-scrolltrigger', 'https://cdn.jsdelivr.net/npm/gsap@3.12/dist/ScrollTrigger.min.js', array( 'gsap' ), '3.12', true );

	wp_enqueue_script(
		'page-annotator-frontend',
		PA_URL . 'assets/js/frontend.js',
		array( 'gsap', 'gsap-scrolltrigger' ),
		PA_VERSION,
		true
	);

	$pa_settings  = pa_get_settings();
	$allowed_html = pa_svg_allowed_html();

	$payload = array();
	foreach ( array( 'cover', 'scribbles' ) as $role ) {
		$payload[ $role ] = array(
			'desktop' => ! empty( $data[ $role ]['desktop'] ) ? wp_kses( $data[ $role ]['desktop'], $allowed_html ) : '',
			'mobile'  => ! empty( $data[ $role ]['mobile'] ) ? wp_kses( $data[ $role ]['mobile'], $allowed_html ) : '',
		);
	}

	wp_localize_script( 'page-annotator-frontend', 'paSettings', array(
		'animationStyle'  => $pa_settings['animation_style'],
		'animationTiming' => ! empty( $pa_settings['animation_timing'] ) ? $pa_settings['animation_timing'] : 'sequential',
		'scrollReverse'   => (bool) $pa_settings['scroll_reverse'],
		'svg'             => $payload,
	) );
}
add_action( 'wp_footer', 'pa_render_overlay' );
