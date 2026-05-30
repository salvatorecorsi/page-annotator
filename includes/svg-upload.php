<?php
/**
 * Page Annotator - SVG upload support + sanitization.
 *
 * @package PageAnnotator
 * @author  Salvatore Corsi
 * @link    https://salvatorecorsi.com
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter( 'upload_mimes', function ( $mimes ) {
	if ( current_user_can( 'edit_posts' ) ) {
		$mimes['svg'] = 'image/svg+xml';
	}
	return $mimes;
} );

// Some servers can't infer the SVG mime from finfo, so WP rejects the upload
// with an empty ext/type. Backfill it for .svg files when the check came back blank.
add_filter( 'wp_check_filetype_and_ext', function ( $data, $file, $filename, $mimes ) {
	if ( ! empty( $data['ext'] ) && ! empty( $data['type'] ) ) {
		return $data;
	}
	if ( preg_match( '/\.svg$/i', (string) $filename ) ) {
		$data['ext']  = 'svg';
		$data['type'] = 'image/svg+xml';
	}
	return $data;
}, 10, 4 );

add_filter( 'wp_handle_upload_prefilter', 'pa_sanitize_svg_upload' );

function pa_sanitize_svg_upload( $file ) {
	if ( empty( $file['tmp_name'] ) ) {
		return $file;
	}

	$is_svg = ( isset( $file['type'] ) && 'image/svg+xml' === $file['type'] )
		|| ( isset( $file['name'] ) && preg_match( '/\.svg$/i', $file['name'] ) );

	if ( ! $is_svg ) {
		return $file;
	}

	if ( ! current_user_can( 'edit_posts' ) ) {
		$file['error'] = __( 'You are not allowed to upload SVG files.', 'page-annotator' );
		return $file;
	}

	$dirty = file_get_contents( $file['tmp_name'] );
	if ( false === $dirty ) {
		return $file;
	}

	$clean = pa_sanitize_svg_markup( $dirty );
	if ( null === $clean ) {
		$file['error'] = __( 'The SVG file could not be sanitized and was rejected.', 'page-annotator' );
		return $file;
	}

	file_put_contents( $file['tmp_name'], $clean );
	return $file;
}

function pa_svg_sanitizer_allowed_tags() {
	return array(
		'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'metadata', 'style',
		'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
		'text', 'tspan', 'textpath', 'image',
		'lineargradient', 'radialgradient', 'stop',
		'clippath', 'mask', 'pattern', 'marker',
		'filter', 'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix',
		'femerge', 'femergenode', 'feflood', 'fecomposite', 'femorphology',
		'fedropshadow', 'fespecularlighting', 'fediffuselighting',
		'fepointlight', 'fespotlight', 'fedistantlight', 'fetile',
		'feturbulence', 'fedisplacementmap', 'feimage', 'fecomponenttransfer',
		'fefunca', 'fefuncr', 'fefuncg', 'fefuncb', 'feconvolvematrix',
	);
}

function pa_sanitize_svg_markup( $svg ) {
	$svg = preg_replace( '/^\xEF\xBB\xBF/', '', trim( (string) $svg ) );
	if ( '' === $svg ) {
		return null;
	}

	$previous = libxml_use_internal_errors( true );
	$dom = new DOMDocument();
	$dom->preserveWhiteSpace = true;
	$dom->formatOutput       = false;

	// No LIBXML_NOENT: entities must NOT be expanded (XXE / billion-laughs).
	$loaded = $dom->loadXML( $svg, LIBXML_NONET );
	libxml_clear_errors();
	libxml_use_internal_errors( $previous );

	if ( ! $loaded || ! $dom->documentElement ) {
		return null;
	}

	// A DOCTYPE is the entry point for entity payloads — reject the whole file.
	foreach ( iterator_to_array( $dom->childNodes ) as $node ) {
		if ( XML_DOCUMENT_TYPE_NODE === $node->nodeType ) {
			return null;
		}
	}

	$root = $dom->documentElement;
	if ( 'svg' !== strtolower( $root->localName ) ) {
		return null;
	}

	$allowed = array_flip( pa_svg_sanitizer_allowed_tags() );
	pa_svg_scrub_node( $root, $allowed );

	$clean = $dom->saveXML( $root );
	return $clean ? $clean : null;
}

function pa_svg_scrub_node( $node, $allowed ) {
	foreach ( iterator_to_array( $node->childNodes ) as $child ) {
		if ( XML_ELEMENT_NODE !== $child->nodeType ) {
			if ( XML_COMMENT_NODE === $child->nodeType || XML_PI_NODE === $child->nodeType ) {
				$node->removeChild( $child );
			}
			continue;
		}

		$tag = strtolower( $child->localName );

		if ( ! isset( $allowed[ $tag ] ) ) {
			$node->removeChild( $child );
			continue;
		}

		pa_svg_scrub_attributes( $child );

		if ( 'style' === $tag ) {
			$child->textContent = pa_svg_scrub_css( $child->textContent );
		}

		pa_svg_scrub_node( $child, $allowed );
	}
}

function pa_svg_scrub_attributes( $el ) {
	if ( ! $el->hasAttributes() ) {
		return;
	}

	foreach ( iterator_to_array( $el->attributes ) as $attr ) {
		$name  = strtolower( $attr->nodeName );
		$value = $attr->nodeValue;

		if ( 0 === strpos( $name, 'on' ) ) {
			$el->removeAttributeNode( $attr );
			continue;
		}

		if ( 'href' === $name || 'xlink:href' === $name || 'src' === $name ) {
			if ( ! pa_svg_uri_is_safe( $value ) ) {
				$el->removeAttributeNode( $attr );
			}
			continue;
		}

		if ( 'style' === $name ) {
			$attr->nodeValue = pa_svg_scrub_css( $value );
		}
	}
}

function pa_svg_uri_is_safe( $value ) {
	$value = preg_replace( '/[\s\x00-\x1F]+/', '', (string) $value );
	if ( '' === $value ) {
		return false;
	}
	if ( '#' === $value[0] ) {
		return true;
	}
	if ( preg_match( '#^data:image/(png|jpe?g|gif|webp);base64,#i', $value ) ) {
		return true;
	}
	if ( preg_match( '#^(https?:|//|/|\./|\.\./)#i', $value ) ) {
		return true;
	}
	// Plain relative path / fragment reference (#id handled above).
	return (bool) preg_match( '#^[a-z0-9_\-./]+(#[a-z0-9_\-]+)?$#i', $value );
}

function pa_svg_scrub_css( $css ) {
	$css = (string) $css;
	if ( '' === trim( $css ) ) {
		return '';
	}
	$patterns = array(
		'/expression\s*\(/i',
		'/javascript\s*:/i',
		'/vbscript\s*:/i',
		'/-moz-binding/i',
		'/behavior\s*:/i',
		'/@import/i',
	);
	return preg_replace( $patterns, '', $css );
}
