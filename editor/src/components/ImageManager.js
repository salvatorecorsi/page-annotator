/**
 * Image transform utilities: move, scale (with rotation), and rotate.
 *
 * Pure functions called by Canvas.jsx pointer handlers when an image is
 * selected in "select" mode. Geometry is expressed in SVG user units, which
 * in the editor map 1:1 to screen pixels (the canvas viewBox equals the slot's
 * pixel size). All scaling math works in the image's local (unrotated) frame
 * so resize handles stay intuitive at any rotation.
 */

const MIN_SIZE = 8;
const DEG = 180 / Math.PI;

const HANDLE_SIGN = {
	nw: { sx: -1, sy: -1 },
	n: { sx: 0, sy: -1 },
	ne: { sx: 1, sy: -1 },
	e: { sx: 1, sy: 0 },
	se: { sx: 1, sy: 1 },
	s: { sx: 0, sy: 1 },
	sw: { sx: -1, sy: 1 },
	w: { sx: -1, sy: 0 },
};

export const RESIZE_HANDLES = [ 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w' ];

function round2( n ) {
	return Math.round( n * 100 ) / 100;
}

function rotate( x, y, rad ) {
	const c = Math.cos( rad );
	const s = Math.sin( rad );
	return { x: x * c - y * s, y: x * s + y * c };
}

export function imageCenter( img ) {
	return { x: img.x + img.width / 2, y: img.y + img.height / 2 };
}

export function startImageTransform( img, handle, point ) {
	return {
		handle,
		start: { x: point.x, y: point.y },
		base: { ...img },
	};
}

export function applyImageTransform( state, point, { shiftKey } = {} ) {
	const { handle, start, base } = state;

	if ( handle === 'move' ) {
		return {
			x: round2( base.x + ( point.x - start.x ) ),
			y: round2( base.y + ( point.y - start.y ) ),
			width: base.width,
			height: base.height,
			rotation: base.rotation,
		};
	}

	if ( handle === 'rotate' ) {
		const c = imageCenter( base );
		let deg = Math.atan2( point.y - c.y, point.x - c.x ) * DEG + 90;
		if ( shiftKey ) {
			deg = Math.round( deg / 15 ) * 15;
		}
		deg = ( ( deg % 360 ) + 360 ) % 360;
		return {
			x: base.x,
			y: base.y,
			width: base.width,
			height: base.height,
			rotation: round2( deg ),
		};
	}

	const sign = HANDLE_SIGN[ handle ];
	if ( ! sign ) {
		return null;
	}

	const theta = ( base.rotation || 0 ) / DEG;
	const c0 = imageCenter( base );

	// Anchor = the corner/edge opposite the dragged handle; stays fixed in world space.
	const anchorLocal = rotate( ( -sign.sx * base.width ) / 2, ( -sign.sy * base.height ) / 2, theta );
	const anchor = { x: c0.x + anchorLocal.x, y: c0.y + anchorLocal.y };

	const rel = rotate( point.x - anchor.x, point.y - anchor.y, -theta );

	let width = base.width;
	let height = base.height;
	if ( sign.sx !== 0 ) {
		width = sign.sx * rel.x;
	}
	if ( sign.sy !== 0 ) {
		height = sign.sy * rel.y;
	}

	const isCorner = sign.sx !== 0 && sign.sy !== 0;
	const lockAspect = isCorner && ! shiftKey;
	if ( lockAspect ) {
		const aspect = base.width / base.height;
		if ( Math.abs( width - base.width ) >= Math.abs( height - base.height ) * aspect ) {
			height = width / aspect;
		} else {
			width = height * aspect;
		}
	}

	width = Math.max( width, MIN_SIZE );
	height = Math.max( height, MIN_SIZE );

	const halfLocal = rotate( ( sign.sx * width ) / 2, ( sign.sy * height ) / 2, theta );
	const center = { x: anchor.x + halfLocal.x, y: anchor.y + halfLocal.y };

	return {
		x: round2( center.x - width / 2 ),
		y: round2( center.y - height / 2 ),
		width: round2( width ),
		height: round2( height ),
		rotation: base.rotation,
	};
}
