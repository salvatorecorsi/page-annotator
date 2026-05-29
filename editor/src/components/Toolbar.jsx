import { useState, useRef } from '@wordpress/element';

const themeColors  = window.pageAnnotator?.themeColors || [];
const strokeWidths = window.pageAnnotator?.strokeWidths || [
	{ value: '2', label: '2' },
	{ value: '4', label: '4' },
	{ value: '8', label: '8' },
	{ value: '12', label: '12' },
	{ value: '20', label: '20' },
];

export default function Toolbar( {
	mode,
	onSetMode,
	strokeColor,
	onSetStrokeColor,
	strokeWidth,
	onSetStrokeWidth,
	role,
	availableRoles,
	onToggleRole,
	breakpoint,
	onToggleBreakpoint,
	layers,
	activeLayerId,
	onSetActiveLayer,
	onAddLayer,
	onDeleteLayer,
	onDuplicateLayer,
	onMoveLayer,
	onRenameLayer,
	canUndo,
	onUndo,
	onResetAll,
	onSave,
	onClose,
	isSaving,
	selectedPathId,
	onDeleteSelected,
} ) {
	const [ showLayers, setShowLayers ] = useState( false );
	const [ showColorPicker, setShowColorPicker ] = useState( false );
	const [ editingLayerId, setEditingLayerId ] = useState( null );
	const renameInputRef = useRef( null );

	function handleRenameStart( layerId ) {
		setEditingLayerId( layerId );
		setTimeout( () => {
			if ( renameInputRef.current ) {
				renameInputRef.current.focus();
				renameInputRef.current.select();
			}
		}, 50 );
	}

	function handleRenameFinish( layerId, newName ) {
		setEditingLayerId( null );
		if ( newName.trim() ) onRenameLayer( layerId, newName.trim() );
	}

	return (
		<div className="pa-bar-container">
			{ /* ─── Layers panel (slides up from bar) ─── */ }
			{ showLayers && (
				<div className="pa-bar-panel pa-bar-panel--layers">
					<div className="pa-bar-panel__header">
						<span>Layers</span>
						<button className="pa-bar-icon-btn" onClick={ onAddLayer } title="Add layer">+</button>
					</div>
					<div className="pa-bar-panel__list">
						{ [ ...layers ].reverse().map( ( layer ) => {
							const isActive = layer.id === activeLayerId;
							const isEditing = editingLayerId === layer.id;
							const idx = layers.indexOf( layer );

							return (
								<div
									key={ layer.id }
									className={ `pa-bar-layer ${ isActive ? 'pa-bar-layer--active' : '' }` }
									onClick={ () => onSetActiveLayer( layer.id ) }
								>
									<div className="pa-bar-layer__name">
										{ isEditing ? (
											<input
												ref={ renameInputRef }
												type="text"
												defaultValue={ layer.name }
												onBlur={ ( e ) => handleRenameFinish( layer.id, e.target.value ) }
												onKeyDown={ ( e ) => {
													if ( e.key === 'Enter' ) handleRenameFinish( layer.id, e.target.value );
													if ( e.key === 'Escape' ) setEditingLayerId( null );
												} }
												onClick={ ( e ) => e.stopPropagation() }
											/>
										) : (
											<span onDoubleClick={ ( e ) => { e.stopPropagation(); handleRenameStart( layer.id ); } }>
												{ layer.name }
											</span>
										) }
										<span className="pa-bar-layer__count">{ layer.paths.length }</span>
									</div>
									<div className="pa-bar-layer__actions">
										<button onClick={ ( e ) => { e.stopPropagation(); onMoveLayer( layer.id, -1 ); } } disabled={ idx === 0 }>↓</button>
										<button onClick={ ( e ) => { e.stopPropagation(); onMoveLayer( layer.id, 1 ); } } disabled={ idx === layers.length - 1 }>↑</button>
										<button onClick={ ( e ) => { e.stopPropagation(); onDuplicateLayer( layer.id ); } }>⧉</button>
										<button className="pa-bar-layer__del" onClick={ ( e ) => { e.stopPropagation(); onDeleteLayer( layer.id ); } } disabled={ layers.length <= 1 }>✕</button>
									</div>
								</div>
							);
						} ) }
					</div>
				</div>
			) }

			{ /* ─── Color picker panel ─── */ }
			{ showColorPicker && (
				<div className="pa-bar-panel pa-bar-panel--colors">
					<input
						type="color"
						value={ strokeColor }
						onChange={ ( e ) => onSetStrokeColor( e.target.value ) }
						className="pa-bar-color-picker-input"
					/>
				</div>
			) }

			{ /* ─── Bottom bar ─── */ }
			<div className="pa-bar">
				{ /* Mode tools */ }
				<div className="pa-bar__group">
					<button
						className={ `pa-bar-btn ${ mode === 'select' ? 'pa-bar-btn--active' : '' }` }
						onClick={ () => onSetMode( 'select' ) }
						title="Select / Move"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
						</svg>
					</button>
					<button
						className={ `pa-bar-btn ${ mode === 'pan' ? 'pa-bar-btn--active' : '' }` }
						onClick={ () => onSetMode( 'pan' ) }
						title="Pan / Move page"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
							<path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
							<path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
							<path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
						</svg>
					</button>
					<button
						className={ `pa-bar-btn ${ mode === 'draw' ? 'pa-bar-btn--active' : '' }` }
						onClick={ () => onSetMode( 'draw' ) }
						title="Draw"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 19l7-7 3 3-7 7-3-3z" />
							<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
							<path d="M2 2l7.586 7.586" />
							<circle cx="11" cy="11" r="2" />
						</svg>
					</button>
					<button
						className={ `pa-bar-btn ${ mode === 'erase' ? 'pa-bar-btn--active' : '' }` }
						onClick={ () => onSetMode( 'erase' ) }
						title="Erase"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M20 20H7l-4-4 10-10 9 9-4 4z" />
							<path d="M6.5 13.5L15 5" />
						</svg>
					</button>
					<button
						className="pa-bar-btn"
						onClick={ onDeleteSelected }
						disabled={ ! selectedPathId || mode !== 'select' }
						title="Delete selected"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
							<line x1="18" y1="9" x2="12" y2="15" />
							<line x1="12" y1="9" x2="18" y2="15" />
						</svg>
					</button>
				</div>

				<div className="pa-bar__sep" />

				{ /* Colors */ }
				<div className="pa-bar__group pa-bar__group--colors">
					{ themeColors.map( ( c ) => (
						<button
							key={ c.slug }
							className={ `pa-bar-swatch ${ strokeColor.toLowerCase() === c.color.toLowerCase() ? 'pa-bar-swatch--active' : '' }` }
							style={ { backgroundColor: c.color } }
							onClick={ () => onSetStrokeColor( c.color ) }
							title={ c.name }
						/>
					) ) }
					<button
						className={ `pa-bar-swatch pa-bar-swatch--custom ${ showColorPicker ? 'pa-bar-swatch--active' : '' }` }
						style={ { background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` } }
						onClick={ () => setShowColorPicker( ! showColorPicker ) }
						title="Custom color"
					/>
				</div>

				<div className="pa-bar__sep" />

				{ /* Stroke width steps */ }
				<div className="pa-bar__group pa-bar__group--widths">
					{ strokeWidths.map( ( sw ) => (
						<button
							key={ sw.value }
							className={ `pa-bar-width ${ String( strokeWidth ) === String( sw.value ) ? 'pa-bar-width--active' : '' }` }
							onClick={ () => onSetStrokeWidth( parseFloat( sw.value ) ) }
							title={ sw.label }
						>
							{ sw.label }
						</button>
					) ) }
				</div>

				<div className="pa-bar__sep" />

				{ /* Layers toggle */ }
				<div className="pa-bar__group">
					<button
						className={ `pa-bar-btn ${ showLayers ? 'pa-bar-btn--active' : '' }` }
						onClick={ () => { setShowLayers( ! showLayers ); setShowColorPicker( false ); } }
						title="Layers"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="12 2 2 7 12 12 22 7 12 2" />
							<polyline points="2 17 12 22 22 17" />
							<polyline points="2 12 12 17 22 12" />
						</svg>
					</button>
				</div>

				<div className="pa-bar__sep" />

				{ /* Actions */ }
				<div className="pa-bar__group">
					<button className="pa-bar-btn" onClick={ onUndo } disabled={ ! canUndo } title="Undo">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="1 4 1 10 7 10" />
							<path d="M3.51 15a9 9 0 105.64-11.36L1 10" />
						</svg>
					</button>
					<button className="pa-bar-btn pa-bar-btn--danger" onClick={ onResetAll } title="Reset all">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polyline points="3 6 5 6 21 6" />
							<path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
						</svg>
					</button>
				</div>

				<div className="pa-bar__spacer" />

				{ /* Role toggle (cover / scribbles) */ }
				{ availableRoles && availableRoles.length > 1 && (
					<div className="pa-bar__group">
						<button
							className={ `pa-bar-btn pa-bar-btn--role ${ role === 'scribbles' ? 'pa-bar-btn--active' : '' }` }
							onClick={ onToggleRole }
							title="Toggle cover / scribbles"
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								{ role === 'cover' ? (
									<>
										<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
										<circle cx="8.5" cy="8.5" r="1.5" />
										<path d="M21 15l-5-5L5 21" />
									</>
								) : (
									<path d="M3 16c2-5 4 3 6-1s3-6 5-2 3 1 4-1" />
								) }
							</svg>
							<span className="pa-bar-btn__label">{ role }</span>
						</button>
					</div>
				) }

				{ /* Breakpoint toggle */ }
				<div className="pa-bar__group">
					<button
						className={ `pa-bar-btn pa-bar-btn--breakpoint ${ breakpoint === 'desktop' ? '' : 'pa-bar-btn--active' }` }
						onClick={ onToggleBreakpoint }
						title="Toggle desktop / mobile"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							{ breakpoint === 'desktop' ? (
								<>
									<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
									<line x1="8" y1="21" x2="16" y2="21" />
									<line x1="12" y1="17" x2="12" y2="21" />
								</>
							) : (
								<>
									<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
									<line x1="12" y1="18" x2="12.01" y2="18" />
								</>
							) }
						</svg>
						<span className="pa-bar-btn__label">{ breakpoint }</span>
					</button>
				</div>

				{ /* Save */ }
				<div className="pa-bar__group">
					<button
						className="pa-bar-btn pa-bar-btn--save"
						onClick={ onSave }
						disabled={ isSaving }
					>
						{ isSaving ? 'Saving...' : 'Save' }
					</button>
				</div>
			</div>
		</div>
	);
}
