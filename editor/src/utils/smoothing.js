/**
 * Catmull-Rom spline to cubic bezier conversion.
 *
 * Converts raw pointer input points into smooth SVG path commands.
 * The Catmull-Rom spline passes through every control point (interpolating)
 * and produces C1-continuous curves with exact conversion to cubic beziers.
 */

function r( n ) {
	return Math.round( n * 100 ) / 100;
}

/**
 * Convert an array of points to an SVG path `d` string using
 * Catmull-Rom to cubic bezier conversion.
 *
 * @param {Array}  points  - Array of {x, y} objects (t is ignored).
 * @param {number} tension - Curve tension (1 = standard Catmull-Rom).
 * @return {string} SVG path d attribute value.
 */
export function catmullRomToBezier( points, tension = 1 ) {
	if ( points.length === 0 ) {
		return '';
	}
	if ( points.length === 1 ) {
		return `M ${ r( points[ 0 ].x ) } ${ r( points[ 0 ].y ) }`;
	}
	if ( points.length === 2 ) {
		return `M ${ r( points[ 0 ].x ) } ${ r( points[ 0 ].y ) } L ${ r( points[ 1 ].x ) } ${ r( points[ 1 ].y ) }`;
	}

	const alpha = 1 / ( 6 * tension );
	let d = `M ${ r( points[ 0 ].x ) } ${ r( points[ 0 ].y ) }`;

	for ( let i = 0; i < points.length - 1; i++ ) {
		const p0 = points[ Math.max( i - 1, 0 ) ];
		const p1 = points[ i ];
		const p2 = points[ i + 1 ];
		const p3 = points[ Math.min( i + 2, points.length - 1 ) ];

		const cp1x = p1.x + ( p2.x - p0.x ) * alpha;
		const cp1y = p1.y + ( p2.y - p0.y ) * alpha;

		const cp2x = p2.x - ( p3.x - p1.x ) * alpha;
		const cp2y = p2.y - ( p3.y - p1.y ) * alpha;

		d += ` C ${ r( cp1x ) } ${ r( cp1y ) }, ${ r( cp2x ) } ${ r( cp2y ) }, ${ r( p2.x ) } ${ r( p2.y ) }`;
	}

	return d;
}
