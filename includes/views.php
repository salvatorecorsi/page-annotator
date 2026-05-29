<?php
/**
 * Page Annotator - View-level annotations (archives, 404).
 *
 * Singular posts keep their annotations in post meta. Views without a single
 * post (post-type archives, blog index, taxonomy archives, 404) are keyed by a
 * resolved string and stored together in one non-autoloaded option.
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve the current view to a storage key, or null when not annotatable.
 * Granularity is per post type, so every archive of a post type shares one key.
 */
function pa_resolve_view_key() {
	if ( is_404() ) {
		return 'special:404';
	}
	if ( is_post_type_archive() ) {
		$post_type = get_query_var( 'post_type' );
		if ( is_array( $post_type ) ) {
			$post_type = reset( $post_type );
		}
		return $post_type ? 'ptype:' . $post_type : null;
	}
	if ( is_home() ) {
		return 'ptype:post';
	}
	if ( is_category() || is_tag() ) {
		return 'ptype:post';
	}
	if ( is_tax() ) {
		$term = get_queried_object();
		if ( $term && isset( $term->taxonomy ) ) {
			$taxonomy = get_taxonomy( $term->taxonomy );
			if ( $taxonomy && ! empty( $taxonomy->object_type ) ) {
				return 'ptype:' . reset( $taxonomy->object_type );
			}
		}
	}
	return null;
}

function pa_is_valid_view_key( $key ) {
	if ( ! is_string( $key ) || '' === $key ) {
		return false;
	}
	if ( 'special:404' === $key ) {
		return true;
	}
	if ( 0 === strpos( $key, 'ptype:' ) ) {
		$post_type = substr( $key, strlen( 'ptype:' ) );
		return post_type_exists( $post_type ) && is_post_type_viewable( $post_type );
	}
	return false;
}

function pa_get_view_record( $key ) {
	$all = get_option( 'page_annotator_views', array() );
	return isset( $all[ $key ] ) && is_array( $all[ $key ] ) ? $all[ $key ] : null;
}

function pa_save_view_record( $key, $svg, $timeline ) {
	$all = get_option( 'page_annotator_views', array() );
	if ( ! is_array( $all ) ) {
		$all = array();
	}
	$all[ $key ] = array(
		'svg'      => $svg,
		'timeline' => $timeline,
	);
	update_option( 'page_annotator_views', $all, false );
}

/**
 * Echo the scribbles slot attribute on archive/404 templates, but only when the
 * current view is annotatable. The same <main> is shared with non-annotatable
 * views (e.g. search), which must stay inert.
 */
function pa_scribbles_slot_attr() {
	if ( pa_resolve_view_key() ) {
		echo ' data-pa-slot="scribbles"';
	}
}

function pa_current_view_url() {
	$scheme = is_ssl() ? 'https://' : 'http://';
	$url    = $scheme . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
	return esc_url_raw( remove_query_arg( array( 'annotation', 'page_annotator_preview' ), $url ) );
}
