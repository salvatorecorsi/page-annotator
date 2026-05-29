import { useState, useRef, useEffect, useCallback } from '@wordpress/element';
import { catmullRomToBezier } from '../utils/smoothing';
import { computePathLength, generatePathId } from '../utils/svg';
import {
	startDrag,
	moveDrag,
	endDrag,
} from './PathManager';

export default function Canvas( {
	mode,
	breakpoint,
	allPaths,
	activeLayerId,
	layers,
	timeline,
	strokeColor,
	strokeWidth,
	selectedPathId,
	viewBox,
	slotElement,
	frameRef,
	onAddPath,
	onAddTimeline,
	onSelectPath,
	onUpdatePath,
	onSetViewBox,
	onPushUndo,
} ) {
	const svgRef = useRef( null );
	const isDrawingRef = useRef( false );
	const currentPointsRef = useRef( [] );
	const strokeStartTimeRef = useRef( 0 );
	const dragStateRef = useRef( null );
	const panStateRef = useRef( null );

	const [ currentStroke, setCurrentStroke ] = useState( null );
	const [ areaBox, setAreaBox ] = useState( null );

	useEffect( () => {
		if ( ! slotElement ) return undefined;

		// The iframe scroll is GSAP/ScrollTrigger-driven, so its window emits no
		// reliable scroll event. Poll the slot's rendered position each frame
		// instead, committing to state only when it moves. The first measure runs
		// synchronously because requestAnimationFrame is suspended while the tab
		// is hidden: without it the overlay would never position until focus.
		let rafId = 0;
		let isMounted = true;
		let lastTop = null;
		let lastLeft = null;
		let lastWidth = null;
		let lastHeight = null;

		function measure() {
			if ( ! isMounted ) return;
			const frameElement = frameRef.current;
			if ( ! frameElement ) {
				rafId = requestAnimationFrame( measure );
				return;
			}
			const slotRect = slotElement.getBoundingClientRect();
			const top = frameElement.offsetTop + slotRect.top;
			const left = frameElement.offsetLeft + slotRect.left;
			const sizeChanged =
				slotRect.width !== lastWidth || slotRect.height !== lastHeight;

			if ( top !== lastTop || left !== lastLeft || sizeChanged ) {
				lastTop = top;
				lastLeft = left;
				lastWidth = slotRect.width;
				lastHeight = slotRect.height;
				setAreaBox( {
					top,
					left,
					width: slotRect.width,
					height: slotRect.height,
				} );
				if ( sizeChanged ) {
					onSetViewBox( {
						width: slotRect.width,
						height: slotRect.height,
					} );
				}
			}

			rafId = requestAnimationFrame( measure );
		}

		measure();

		return () => {
			isMounted = false;
			if ( rafId ) cancelAnimationFrame( rafId );
		};
	}, [ slotElement, breakpoint, onSetViewBox, frameRef ] );

	useEffect( () => {
		const body = document.body;
		body.classList.remove( 'pa-draw-active', 'pa-select-active', 'pa-erase-active', 'pa-pan-active' );
		if ( mode === 'draw' ) body.classList.add( 'pa-draw-active' );
		else if ( mode === 'select' ) body.classList.add( 'pa-select-active' );
		else if ( mode === 'erase' ) body.classList.add( 'pa-erase-active' );
		else if ( mode === 'pan' ) body.classList.add( 'pa-pan-active' );
		return () => body.classList.remove( 'pa-draw-active', 'pa-select-active', 'pa-erase-active', 'pa-pan-active' );
	}, [ mode ] );

	useEffect( () => {
		function handleKeyDown( e ) {
			if ( selectedPathId && mode === 'select' && ( e.key === 'Delete' || e.key === 'Backspace' ) ) {
				e.preventDefault();
				onPushUndo();
				onUpdatePath( selectedPathId, null );
				onSelectPath( null );
			}
		}
		window.addEventListener( 'keydown', handleKeyDown );
		return () => window.removeEventListener( 'keydown', handleKeyDown );
	}, [ selectedPathId, mode, onUpdatePath, onSelectPath, onPushUndo ] );

	useEffect( () => {
		const svg = svgRef.current;
		if ( ! svg ) return;

		function getPointInSVG( e ) {
			const CTM = svg.getScreenCTM();
			if ( ! CTM ) return { x: e.clientX, y: e.clientY };
			const inverseCTM = CTM.inverse();
			const pt = svg.createSVGPoint();
			pt.x = e.clientX;
			pt.y = e.clientY;
			const transformed = pt.matrixTransform( inverseCTM );
			return {
				x: Math.round( transformed.x * 100 ) / 100,
				y: Math.round( transformed.y * 100 ) / 100,
			};
		}

		function onPointerDown( e ) {
			if ( e.target.closest( '.pa-bar-container' ) ) return;

			if ( mode === 'draw' ) {
				e.preventDefault();
				const point = getPointInSVG( e );
				currentPointsRef.current = [ { x: point.x, y: point.y, t: 0 } ];
				strokeStartTimeRef.current = Date.now();
				isDrawingRef.current = true;
				setCurrentStroke( { d: `M ${ point.x } ${ point.y }` } );
			} else if ( mode === 'select' ) {
				const target = e.target;
				if ( target.tagName === 'path' && target.id ) {
					const pathObj = allPaths.find( ( p ) => p.id === target.id );
					if ( pathObj ) {
						onSelectPath( pathObj.id );
						const point = getPointInSVG( e );
						dragStateRef.current = startDrag( pathObj, point );
						e.preventDefault();
					}
				} else {
					onSelectPath( null );
				}
			} else if ( mode === 'erase' ) {
				const target = e.target;
				if ( target.tagName === 'path' && target.id ) {
					const pathObj = allPaths.find( ( p ) => p.id === target.id );
					if ( pathObj ) {
						e.preventDefault();
						onPushUndo();
						onUpdatePath( pathObj.id, null );
					}
				}
			} else if ( mode === 'pan' ) {
				const win = frameRef.current && frameRef.current.contentWindow;
				if ( win ) {
					e.preventDefault();
					panStateRef.current = {
						x: e.clientX,
						y: e.clientY,
						scrollX: win.scrollX,
						scrollY: win.scrollY,
					};
				}
			}
		}

		function onPointerMove( e ) {
			if ( mode === 'draw' && isDrawingRef.current ) {
				e.preventDefault();
				const point = getPointInSVG( e );
				const t = Date.now() - strokeStartTimeRef.current;
				currentPointsRef.current.push( { x: point.x, y: point.y, t } );
				const smoothedD = catmullRomToBezier( currentPointsRef.current );
				setCurrentStroke( { d: smoothedD } );
			} else if ( mode === 'select' && dragStateRef.current ) {
				e.preventDefault();
				const point = getPointInSVG( e );
				const newTransform = moveDrag( dragStateRef.current, point );
				const el = svg.querySelector( `#${ CSS.escape( dragStateRef.current.pathId ) }` );
				if ( el && newTransform ) el.setAttribute( 'transform', newTransform );
			} else if ( mode === 'pan' && panStateRef.current ) {
				e.preventDefault();
				const win = frameRef.current && frameRef.current.contentWindow;
				if ( win ) {
					const dx = e.clientX - panStateRef.current.x;
					const dy = e.clientY - panStateRef.current.y;
					win.scrollTo(
						panStateRef.current.scrollX - dx,
						panStateRef.current.scrollY - dy
					);
				}
			}
		}

		function onPointerUp() {
			if ( mode === 'draw' && isDrawingRef.current ) {
				isDrawingRef.current = false;
				const points = currentPointsRef.current;
				if ( points.length < 2 ) { setCurrentStroke( null ); return; }

				const finalD = catmullRomToBezier( points );
				const newId = generatePathId( allPaths );
				const order = allPaths.length;
				const pathLength = computePathLength( finalD );
				const strokeDuration = ( points[ points.length - 1 ].t / 1000 ).toFixed( 2 );

				const newPath = {
					id: newId,
					d: finalD,
					stroke: strokeColor,
					strokeWidth,
					transform: null,
					order,
					dataDuration: parseFloat( strokeDuration ) < 0.2 ? '0.3' : strokeDuration,
					dataDelay: '0',
					dashArray: pathLength,
					dashOffset: pathLength,
				};

				onPushUndo();
				onAddPath( newPath );
				onAddTimeline( newId, {
					points,
					startTime: strokeStartTimeRef.current,
					duration: points[ points.length - 1 ].t,
				} );
				setCurrentStroke( null );
			} else if ( mode === 'select' && dragStateRef.current ) {
				const finalTransform = endDrag( dragStateRef.current );
				if ( finalTransform !== undefined ) {
					onPushUndo();
					onUpdatePath( dragStateRef.current.pathId, { transform: finalTransform } );
				}
				dragStateRef.current = null;
			} else if ( mode === 'pan' ) {
				panStateRef.current = null;
			}
		}

		function onPointerCancel() {
			if ( isDrawingRef.current ) { isDrawingRef.current = false; setCurrentStroke( null ); }
			dragStateRef.current = null;
			panStateRef.current = null;
		}

		function onTouchStart( e ) {
			if ( mode === 'draw' || mode === 'pan' ) e.preventDefault();
		}

		svg.addEventListener( 'pointerdown', onPointerDown );
		svg.addEventListener( 'touchstart', onTouchStart, { passive: false } );
		document.addEventListener( 'pointermove', onPointerMove );
		document.addEventListener( 'pointerup', onPointerUp );
		document.addEventListener( 'pointercancel', onPointerCancel );

		return () => {
			svg.removeEventListener( 'pointerdown', onPointerDown );
			svg.removeEventListener( 'touchstart', onTouchStart );
			document.removeEventListener( 'pointermove', onPointerMove );
			document.removeEventListener( 'pointerup', onPointerUp );
			document.removeEventListener( 'pointercancel', onPointerCancel );
		};
	}, [ mode, allPaths, strokeColor, strokeWidth, selectedPathId, onAddPath, onAddTimeline, onSelectPath, onUpdatePath, onPushUndo, frameRef ] );

	const vb = viewBox || { width: 800, height: 400 };
	const areaStyle = areaBox
		? {
				top: areaBox.top + 'px',
				left: areaBox.left + 'px',
				width: areaBox.width + 'px',
				height: areaBox.height + 'px',
		  }
		: { display: 'none' };

	return (
		<div className="pa-canvas-area" style={ areaStyle }>
			<svg
				ref={ svgRef }
				className="pa-canvas-svg"
				xmlns="http://www.w3.org/2000/svg"
				viewBox={ `0 0 ${ vb.width } ${ vb.height }` }
				preserveAspectRatio="none"
			>
				{ allPaths.map( ( path ) => (
					<path
						key={ path.id }
						id={ path.id }
						d={ path.d }
						fill="none"
						stroke={ path.stroke }
						strokeWidth={ path.strokeWidth }
						strokeLinecap="round"
						strokeLinejoin="round"
						transform={ path.transform || undefined }
						className={ selectedPathId === path.id ? 'pa-path-selected' : '' }
						style={ mode === 'select' ? { cursor: 'pointer' } : undefined }
					/>
				) ) }
				{ currentStroke && (
					<path
						d={ currentStroke.d }
						fill="none"
						stroke={ strokeColor }
						strokeWidth={ strokeWidth }
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				) }
			</svg>
		</div>
	);
}
