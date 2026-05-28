(function () {
	'use strict';

	const settings = window.paSettings || {};
	const svgData  = settings.svg || {};

	const style        = settings.animationStyle || 'smooth';
	const timing       = settings.animationTiming || 'sequential';
	const reverse      = settings.scrollReverse !== false;
	const simultaneous = timing === 'simultaneous';

	const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
	if (hasGsap) gsap.registerPlugin(ScrollTrigger);

	const easingMap = {
		smooth:  'power2.inOut',
		stepped: 'steps(12)',
		fast:    'power4.out',
		elastic: 'elastic.out(1, 0.3)',
		rough:   'steps(20)'
	};

	const speedMap = {
		smooth: 1, stepped: 0.6, fast: 0.35, elastic: 1.2, rough: 0.7
	};

	const roles = ['cover', 'scribbles'];
	let animated = false;

	roles.forEach(function (role) {
		const data = svgData[role];
		if (!data || (!data.desktop && !data.mobile)) return;

		const slot = document.querySelector('[data-pa-slot="' + role + '"]');
		if (!slot) return;

		const computed = getComputedStyle(slot);
		if (computed.position === 'static') {
			slot.style.position = 'relative';
		}

		const overlay = buildOverlay(role, data);
		slot.appendChild(overlay);

		if (!hasGsap) return;

		if (style === 'none') {
			overlay.querySelectorAll('path').forEach(function (p) {
				p.setAttribute('stroke-dashoffset', '0');
			});
			return;
		}

		animateOverlay(overlay, slot);
		animated = true;
	});

	if (animated) ScrollTrigger.refresh();

	function buildOverlay(role, data) {
		const hasDesktop = !!data.desktop;
		const hasMobile  = !!data.mobile;

		const overlay = document.createElement('div');
		overlay.id = 'page-annotator-overlay-' + role;
		overlay.className = 'page-annotator-overlay page-annotator-overlay--' + role
			+ (hasDesktop ? ' page-annotator-overlay--has-desktop' : '')
			+ (hasMobile  ? ' page-annotator-overlay--has-mobile'  : '');

		if (hasDesktop) {
			const dLayer = document.createElement('div');
			dLayer.className = 'page-annotator-layer page-annotator-desktop';
			dLayer.innerHTML = data.desktop;
			overlay.appendChild(dLayer);
		}

		if (hasMobile) {
			const mLayer = document.createElement('div');
			mLayer.className = 'page-annotator-layer page-annotator-mobile';
			mLayer.innerHTML = data.mobile;
			overlay.appendChild(mLayer);
		}

		return overlay;
	}

	function animateOverlay(overlay, slot) {
		const layers = overlay.querySelectorAll('.page-annotator-layer');

		layers.forEach(function (layer) {
			const svgEl = layer.querySelector('svg');
			if (!svgEl) return;

			svgEl.removeAttribute('width');
			svgEl.removeAttribute('height');
			svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

			const groups = svgEl.querySelectorAll(':scope > g');
			if (groups.length) {
				groups.forEach(function (group) {
					animatePaths(Array.from(group.querySelectorAll('path')), slot);
				});
			} else {
				animatePaths(Array.from(layer.querySelectorAll('path')), slot);
			}
		});
	}

	function animatePaths(paths, slot) {
		if (!paths.length) return;

		paths.sort(function (a, b) {
			return (parseInt(a.dataset.order, 10) || 0) - (parseInt(b.dataset.order, 10) || 0);
		});

		const tl = gsap.timeline({ paused: true });

		paths.forEach(function (path) {
			const base   = parseFloat(path.dataset.duration) || 0.8;
			let duration = base * (speedMap[style] || 1);
			let ease     = easingMap[style] || 'power2.inOut';

			if (style === 'rough') {
				ease     = 'steps(' + Math.max(8, Math.round(base * 15)) + ')';
				duration *= (0.85 + Math.random() * 0.3);
			}

			tl.to(path, { strokeDashoffset: 0, duration: duration, ease: ease }, simultaneous ? 0 : undefined);
		});

		ScrollTrigger.create({
			trigger:       slot,
			start:         'top 90%',
			end:           'bottom 10%',
			toggleActions: reverse ? 'play reverse play reverse' : 'play none none none',
			animation:     tl
		});
	}
})();
