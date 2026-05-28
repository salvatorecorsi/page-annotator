/**
 * Path selection, drag-to-reposition, and delete utilities.
 *
 * These are pure functions, not a React component. They are called
 * by Canvas.jsx event handlers when in "select" mode.
 */

/**
 * Start a drag operation on a path.
 *
 * @param {Object} pathObj   - The path object being dragged.
 * @param {Object} svgPoint  - Initial pointer position in SVG coords { x, y }.
 * @return {Object} Drag state to pass to moveDrag/endDrag.
 */
export function startDrag( pathObj, svgPoint ) {
	// Parse existing translate if present
	let prevDx = 0;
	let prevDy = 0;
	if ( pathObj.transform ) {
		const match = pathObj.transform.match(
			/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/
		);
		if ( match ) {
			prevDx = parseFloat( match[ 1 ] );
			prevDy = parseFloat( match[ 2 ] );
		}
	}

	return {
		pathId: pathObj.id,
		startX: svgPoint.x,
		startY: svgPoint.y,
		prevDx,
		prevDy,
		currentDx: prevDx,
		currentDy: prevDy,
		moved: false,
	};
}

/**
 * Update drag position.
 *
 * @param {Object} dragState - State from startDrag.
 * @param {Object} svgPoint  - Current pointer position in SVG coords { x, y }.
 * @return {string} New transform attribute value.
 */
export function moveDrag( dragState, svgPoint ) {
	const dx = svgPoint.x - dragState.startX;
	const dy = svgPoint.y - dragState.startY;

	dragState.currentDx = dragState.prevDx + dx;
	dragState.currentDy = dragState.prevDy + dy;

	if ( Math.abs( dx ) > 2 || Math.abs( dy ) > 2 ) {
		dragState.moved = true;
	}

	const tx = Math.round( dragState.currentDx * 100 ) / 100;
	const ty = Math.round( dragState.currentDy * 100 ) / 100;

	return `translate(${ tx }, ${ ty })`;
}

/**
 * End a drag operation.
 *
 * @param {Object} dragState - State from startDrag (mutated by moveDrag).
 * @return {string|null|undefined} Final transform, null to remove, undefined if no movement.
 */
export function endDrag( dragState ) {
	if ( ! dragState.moved ) {
		return undefined; // No movement, no update needed
	}

	const tx = Math.round( dragState.currentDx * 100 ) / 100;
	const ty = Math.round( dragState.currentDy * 100 ) / 100;

	if ( tx === 0 && ty === 0 ) {
		return null; // Reset to no transform
	}

	return `translate(${ tx }, ${ ty })`;
}
