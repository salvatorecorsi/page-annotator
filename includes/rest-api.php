<?php
/**
 * Page Annotator - REST API endpoints and helpers.
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function pa_svg_allowed_html() {
	return array(
		'svg'  => array(
			'xmlns'               => true,
			'viewbox'             => true,
			'width'               => true,
			'height'              => true,
			'class'               => true,
			'id'                  => true,
			'preserveaspectratio' => true,
		),
		'path' => array(
			'd'                   => true,
			'id'                  => true,
			'fill'                => true,
			'stroke'              => true,
			'stroke-width'        => true,
			'stroke-linecap'      => true,
			'stroke-linejoin'     => true,
			'transform'           => true,
			'stroke-dasharray'    => true,
			'stroke-dashoffset'   => true,
			'data-duration'       => true,
			'data-delay'          => true,
			'data-order'          => true,
			'opacity'             => true,
		),
		'g'     => array(
			'id'        => true,
			'data-name' => true,
			'transform' => true,
			'class'     => true,
		),
		'image' => array(
			'href'                => true,
			'xlink:href'          => true,
			'x'                   => true,
			'y'                   => true,
			'width'               => true,
			'height'              => true,
			'transform'           => true,
			'preserveaspectratio' => true,
			'opacity'             => true,
			'id'                  => true,
			'class'               => true,
		),
	);
}

function pa_normalize_svg_data( $raw ) {
	$normalized = array(
		'cover'     => array( 'desktop' => '', 'mobile' => '' ),
		'scribbles' => array( 'desktop' => '', 'mobile' => '' ),
	);

	if ( ! is_array( $raw ) ) {
		return $normalized;
	}

	// Legacy flat format { desktop, mobile } is treated as the cover role.
	if ( ! isset( $raw['cover'] ) && ! isset( $raw['scribbles'] ) && ( isset( $raw['desktop'] ) || isset( $raw['mobile'] ) ) ) {
		$normalized['cover']['desktop'] = isset( $raw['desktop'] ) ? (string) $raw['desktop'] : '';
		$normalized['cover']['mobile']  = isset( $raw['mobile'] ) ? (string) $raw['mobile'] : '';
		return $normalized;
	}

	foreach ( array( 'cover', 'scribbles' ) as $role ) {
		if ( isset( $raw[ $role ] ) && is_array( $raw[ $role ] ) ) {
			$normalized[ $role ]['desktop'] = isset( $raw[ $role ]['desktop'] ) ? (string) $raw[ $role ]['desktop'] : '';
			$normalized[ $role ]['mobile']  = isset( $raw[ $role ]['mobile'] ) ? (string) $raw[ $role ]['mobile'] : '';
		}
	}

	return $normalized;
}

function pa_normalize_timeline_data( $raw ) {
	$normalized = array(
		'cover'     => array( 'desktop' => array(), 'mobile' => array() ),
		'scribbles' => array( 'desktop' => array(), 'mobile' => array() ),
	);

	if ( ! is_array( $raw ) ) {
		return $normalized;
	}

	if ( ! isset( $raw['cover'] ) && ! isset( $raw['scribbles'] ) && ( isset( $raw['desktop'] ) || isset( $raw['mobile'] ) ) ) {
		$normalized['cover']['desktop'] = isset( $raw['desktop'] ) && is_array( $raw['desktop'] ) ? $raw['desktop'] : array();
		$normalized['cover']['mobile']  = isset( $raw['mobile'] ) && is_array( $raw['mobile'] ) ? $raw['mobile'] : array();
		return $normalized;
	}

	foreach ( array( 'cover', 'scribbles' ) as $role ) {
		if ( isset( $raw[ $role ] ) && is_array( $raw[ $role ] ) ) {
			$normalized[ $role ]['desktop'] = isset( $raw[ $role ]['desktop'] ) && is_array( $raw[ $role ]['desktop'] ) ? $raw[ $role ]['desktop'] : array();
			$normalized[ $role ]['mobile']  = isset( $raw[ $role ]['mobile'] ) && is_array( $raw[ $role ]['mobile'] ) ? $raw[ $role ]['mobile'] : array();
		}
	}

	return $normalized;
}

function pa_svg_data_has_any( $data ) {
	if ( ! is_array( $data ) ) {
		return false;
	}
	foreach ( array( 'cover', 'scribbles' ) as $role ) {
		if ( ! empty( $data[ $role ]['desktop'] ) || ! empty( $data[ $role ]['mobile'] ) ) {
			return true;
		}
	}
	return false;
}

function pa_rest_permission() {
	return current_user_can( 'edit_posts' );
}

function pa_sanitize_timeline( $data ) {
	if ( ! is_array( $data ) ) {
		return array();
	}

	$clean = array();

	foreach ( $data as $breakpoint => $paths ) {
		if ( ! in_array( $breakpoint, array( 'desktop', 'mobile' ), true ) ) {
			continue;
		}

		if ( ! is_array( $paths ) ) {
			$clean[ $breakpoint ] = array();
			continue;
		}

		$clean[ $breakpoint ] = array();

		foreach ( $paths as $path_id => $path_data ) {
			$safe_id = sanitize_text_field( $path_id );

			if ( ! is_array( $path_data ) ) {
				continue;
			}

			$entry = array(
				'points'    => array(),
				'startTime' => isset( $path_data['startTime'] ) ? floatval( $path_data['startTime'] ) : 0,
				'duration'  => isset( $path_data['duration'] ) ? floatval( $path_data['duration'] ) : 0,
			);

			if ( isset( $path_data['points'] ) && is_array( $path_data['points'] ) ) {
				foreach ( $path_data['points'] as $point ) {
					if ( is_array( $point ) && isset( $point['x'], $point['y'], $point['t'] ) ) {
						$entry['points'][] = array(
							'x' => floatval( $point['x'] ),
							'y' => floatval( $point['y'] ),
							't' => floatval( $point['t'] ),
						);
					}
				}
			}

			$clean[ $breakpoint ][ $safe_id ] = $entry;
		}
	}

	return $clean;
}

add_action( 'rest_api_init', function () {
	$namespace = 'page-annotator';

	register_rest_route( $namespace, '/annotations/(?P<post_id>\d+)', array(
		array(
			'methods'             => 'GET',
			'callback'            => 'pa_get_annotations',
			'permission_callback' => 'pa_rest_permission',
			'args'                => array(
				'post_id' => array(
					'validate_callback' => function ( $value ) {
						return is_numeric( $value ) && intval( $value ) > 0;
					},
					'sanitize_callback' => 'absint',
				),
			),
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'pa_save_annotations',
			'permission_callback' => 'pa_rest_permission',
			'args'                => array(
				'post_id' => array(
					'validate_callback' => function ( $value ) {
						return is_numeric( $value ) && intval( $value ) > 0;
					},
					'sanitize_callback' => 'absint',
				),
			),
		),
	) );

	register_rest_route( $namespace, '/annotations-view/(?P<key>[A-Za-z0-9:_\-]+)', array(
		array(
			'methods'             => 'GET',
			'callback'            => 'pa_get_view_annotations',
			'permission_callback' => 'pa_rest_permission',
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'pa_save_view_annotations',
			'permission_callback' => 'pa_rest_permission',
		),
	) );
} );

function pa_get_annotations( WP_REST_Request $request ) {
	$post_id = $request->get_param( 'post_id' );

	if ( ! get_post( $post_id ) ) {
		return new WP_Error( 'not_found', __( 'Post not found.', 'page-annotator' ), array( 'status' => 404 ) );
	}

	$svg_json      = get_post_meta( $post_id, '_page_annotator_svg', true );
	$timeline_json = get_post_meta( $post_id, '_page_annotator_timeline', true );

	$svg      = pa_normalize_svg_data( ! empty( $svg_json ) ? json_decode( $svg_json, true ) : null );
	$timeline = pa_normalize_timeline_data( ! empty( $timeline_json ) ? json_decode( $timeline_json, true ) : null );

	return rest_ensure_response( array(
		'svg'      => $svg,
		'timeline' => $timeline,
		'post_id'  => $post_id,
	) );
}

function pa_save_annotations( WP_REST_Request $request ) {
	$post_id = $request->get_param( 'post_id' );

	if ( ! get_post( $post_id ) ) {
		return new WP_Error( 'not_found', __( 'Post not found.', 'page-annotator' ), array( 'status' => 404 ) );
	}

	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return new WP_Error( 'forbidden', __( 'You cannot edit this post.', 'page-annotator' ), array( 'status' => 403 ) );
	}

	$params   = $request->get_json_params();
	$svg      = isset( $params['svg'] ) ? $params['svg'] : array();
	$timeline = isset( $params['timeline'] ) ? $params['timeline'] : array();

	$allowed_html = pa_svg_allowed_html();

	$svg_in        = pa_normalize_svg_data( $svg );
	$sanitized_svg = array();
	foreach ( array( 'cover', 'scribbles' ) as $role ) {
		$sanitized_svg[ $role ] = array(
			'desktop' => wp_kses( $svg_in[ $role ]['desktop'], $allowed_html ),
			'mobile'  => wp_kses( $svg_in[ $role ]['mobile'], $allowed_html ),
		);
	}

	$tl_in              = pa_normalize_timeline_data( $timeline );
	$sanitized_timeline = array(
		'cover'     => pa_sanitize_timeline( $tl_in['cover'] ),
		'scribbles' => pa_sanitize_timeline( $tl_in['scribbles'] ),
	);

	// wp_slash() is required because update_post_meta() internally calls
	// wp_unslash(), which would strip the backslashes that JSON uses to
	// escape double quotes inside SVG attribute values.
	update_post_meta( $post_id, '_page_annotator_svg', wp_slash( wp_json_encode( $sanitized_svg ) ) );
	update_post_meta( $post_id, '_page_annotator_timeline', wp_slash( wp_json_encode( $sanitized_timeline ) ) );

	return rest_ensure_response( array(
		'saved'   => true,
		'post_id' => $post_id,
	) );
}

function pa_get_view_annotations( WP_REST_Request $request ) {
	$key = $request->get_param( 'key' );

	if ( ! pa_is_valid_view_key( $key ) ) {
		return new WP_Error( 'invalid_key', __( 'Invalid view key.', 'page-annotator' ), array( 'status' => 400 ) );
	}

	$record   = pa_get_view_record( $key );
	$svg      = pa_normalize_svg_data( $record && isset( $record['svg'] ) ? $record['svg'] : null );
	$timeline = pa_normalize_timeline_data( $record && isset( $record['timeline'] ) ? $record['timeline'] : null );

	return rest_ensure_response( array(
		'svg'      => $svg,
		'timeline' => $timeline,
		'view_key' => $key,
	) );
}

function pa_save_view_annotations( WP_REST_Request $request ) {
	$key = $request->get_param( 'key' );

	if ( ! pa_is_valid_view_key( $key ) ) {
		return new WP_Error( 'invalid_key', __( 'Invalid view key.', 'page-annotator' ), array( 'status' => 400 ) );
	}

	$params   = $request->get_json_params();
	$svg      = isset( $params['svg'] ) ? $params['svg'] : array();
	$timeline = isset( $params['timeline'] ) ? $params['timeline'] : array();

	$allowed_html = pa_svg_allowed_html();

	$svg_in        = pa_normalize_svg_data( $svg );
	$sanitized_svg = array();
	foreach ( array( 'cover', 'scribbles' ) as $role ) {
		$sanitized_svg[ $role ] = array(
			'desktop' => wp_kses( $svg_in[ $role ]['desktop'], $allowed_html ),
			'mobile'  => wp_kses( $svg_in[ $role ]['mobile'], $allowed_html ),
		);
	}

	$tl_in              = pa_normalize_timeline_data( $timeline );
	$sanitized_timeline = array(
		'cover'     => pa_sanitize_timeline( $tl_in['cover'] ),
		'scribbles' => pa_sanitize_timeline( $tl_in['scribbles'] ),
	);

	pa_save_view_record( $key, $sanitized_svg, $sanitized_timeline );

	return rest_ensure_response( array(
		'saved'    => true,
		'view_key' => $key,
	) );
}

