<?php
/**
 * Page Annotator - Virtual thumbnail from SVG annotations.
 *
 * When a post has desktop annotations and no real featured image,
 * WordPress thumbnail functions (has_post_thumbnail, get_the_post_thumbnail)
 * return the SVG annotation as inline markup.
 *
 * @package PageAnnotator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PA_VIRTUAL_THUMB_ID', -1 );

function pa_post_has_cover_svg( $post_id ) {
	$svg_json = get_post_meta( $post_id, '_page_annotator_svg', true );
	if ( empty( $svg_json ) ) {
		return false;
	}
	$data = pa_normalize_svg_data( json_decode( $svg_json, true ) );
	return ! empty( $data['cover']['desktop'] );
}

function pa_get_cover_desktop_svg( $post_id ) {
	$svg_json = get_post_meta( $post_id, '_page_annotator_svg', true );
	if ( empty( $svg_json ) ) {
		return '';
	}
	$data = pa_normalize_svg_data( json_decode( $svg_json, true ) );
	return $data['cover']['desktop'];
}

add_filter( 'post_thumbnail_id', function ( $thumbnail_id, $post ) {
	if ( $thumbnail_id > 0 ) {
		return $thumbnail_id;
	}

	$post_id = is_object( $post ) ? $post->ID : (int) $post;
	if ( ! pa_post_has_cover_svg( $post_id ) ) {
		return $thumbnail_id;
	}

	return PA_VIRTUAL_THUMB_ID;
}, 10, 2 );

add_filter( 'post_thumbnail_html', function ( $html, $post_id, $thumbnail_id, $size, $attr ) {
	if ( (int) $thumbnail_id !== PA_VIRTUAL_THUMB_ID ) {
		return $html;
	}

	$svg_raw = pa_get_cover_desktop_svg( $post_id );
	if ( ! $svg_raw ) {
		return $html;
	}

	$allowed_html = pa_svg_allowed_html();
	$svg_clean    = wp_kses( $svg_raw, $allowed_html );

	$class = 'pa-svg-thumbnail';
	if ( ! empty( $attr['class'] ) ) {
		$class .= ' ' . $attr['class'];
	}

	return '<div class="' . esc_attr( $class ) . '" style="position:relative;overflow:hidden;">' . $svg_clean . '</div>';
}, 10, 5 );
