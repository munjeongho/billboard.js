/**
 * Copyright (c) 2017 ~ present NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {
	mouse as d3Mouse,
	select as d3Select
} from "d3-selection";
import {drag as d3Drag} from "d3-drag";
import CLASS from "../../config/classes";
import {KEY} from "../../module/Cache";
import {emulateEvent, isNumber, isObject} from "../../module/util";

export default {
	selectRectForSingle(context, eventRect, index: number): void {
		const $$ = this;
		const {config, $el: {main}} = $$;
		const isSelectionEnabled = config.data_selection_enabled;
		const isSelectionGrouped = config.data_selection_grouped;
		const isSelectable = config.data_selection_isselectable;
		const isTooltipGrouped = config.tooltip_grouped;
		const selectedData = $$.getAllValuesOnIndex(index);

		if (isTooltipGrouped) {
			$$.showTooltip(selectedData, context);
			$$.showGridFocus && $$.showGridFocus(selectedData);

			if (!isSelectionEnabled || isSelectionGrouped) {
				return;
			}
		}

		main.selectAll(`.${CLASS.shape}-${index}`)
			.each(function() {
				d3Select(this).classed(CLASS.EXPANDED, true);

				if (isSelectionEnabled) {
					eventRect.style("cursor", isSelectionGrouped ? "pointer" : null);
				}

				if (!isTooltipGrouped) {
					$$.hideGridFocus && $$.hideGridFocus();
					$$.hideTooltip();

					!isSelectionGrouped && $$.expandCirclesBars(index);
				}
			})
			.filter(function(d) {
				return $$.isWithinShape(this, d);
			})
			.call(selected => {
				const d = selected.data();

				if (isSelectionEnabled &&
					(isSelectionGrouped || (isSelectable && isSelectable.bind($$.api)(d)))
				) {
					eventRect.style("cursor", "pointer");
				}

				if (!isTooltipGrouped) {
					$$.showTooltip(d, context);
					$$.showGridFocus && $$.showGridFocus(d);

					$$.unexpandCircles();
					selected.each(d => $$.expandCirclesBars(index, d.id));
				}
			});
	},

	expandCirclesBars(index: number, id: string, reset: boolean): void {
		const $$ = this;
		const {config, $el: {bar, circle}} = $$;

		circle && config.point_focus_expand_enabled &&
			$$.expandCircles(index, id, reset);

		bar && $$.expandBars(index, id, reset);
	},

	/**
	 * Handle data.onover/out callback options
	 * @param {boolean} isOver Over or not
	 * @param {number|object} d data object
	 * @private
	 */
	setOverOut(isOver: boolean, d): void {
		const $$ = this;
		const {config, state: {hasRadar}, $el: {main}} = $$;
		const isArc = isObject(d);

		// Call event handler
		if (isArc || d !== -1) {
			let callback = config[isOver ? "data_onover" : "data_onout"].bind($$.api);

			config.color_onover && $$.setOverColor(isOver, d, isArc);

			if (isArc) {
				callback(d, main.select(`.${CLASS.arc}${$$.getTargetSelectorSuffix(d.id)}`).node());
			} else if (!config.tooltip_grouped) {
				let last = $$.cache.get(KEY.setOverOut) || [];


				const shape = main.selectAll(`.${CLASS.shape}-${d}`)
					.filter(function(d) {
						return $$.isWithinShape(this, d);
					});

				shape
					.each(function(d) {
						if (last.length === 0 || last.every(v => v !== this)) {
							callback(d, this);
							last.push(this);
						}
					});

				if (last.length > 0 && shape.empty()) {
					callback = config.data_onout.bind($$.api);

					last.forEach(v => callback(d3Select(v).datum(), v));
					last = [];
				}

				$$.cache.add(KEY.setOverOut, last);
			} else {
				if (isOver) {
					config.point_focus_only && hasRadar ?
						$$.showCircleFocus($$.getAllValuesOnIndex(d, true)) :
						$$.expandCirclesBars(d, null, true);
				}

				!$$.isMultipleX() && main.selectAll(`.${CLASS.shape}-${d}`)
					.each(function(d) {
						callback(d, this);
					});
			}
		}
	},

	/**
	 * Call data.onover/out callback for touch event
	 * @param {number|object} d target index or data object for Arc type
	 * @private
	 */
	callOverOutForTouch(d): void {
		const $$ = this;
		const last = $$.cache.get(KEY.callOverOutForTouch);

		if (isObject(d) && last ? d.id !== last.id : (d !== last)) {
			(last || isNumber(last)) && $$.setOverOut(false, last);
			(d || isNumber(d)) && $$.setOverOut(true, d);

			$$.cache.add(KEY.callOverOutForTouch, d);
		}
	},

	/**
	 * Return draggable selection function
	 * @returns {Function}
	 * @private
	 */
	getDraggableSelection(): Function {
		const $$ = this;
		const {config} = $$;

		return config.interaction_enabled && config.data_selection_draggable && $$.drag ?
			d3Drag()
				.on("drag", function() {
					// @ts-ignore
					$$.drag(d3Mouse(this));
				})
				.on("start", function() {
					// @ts-ignore
					$$.dragstart(d3Mouse(this));
				})
				.on("end", () => { $$.dragend(); }) : () => {};
	},

	/**
	 * Dispatch a mouse event.
	 * @private
	 * @param {string} type event type
	 * @param {number} index Index of eventRect
	 * @param {Array} mouse x and y coordinate value
	 */
	dispatchEvent(type: string, index: number, mouse): void {
		const $$ = this;
		const {state: {hasRadar}, $el: {main, radar}} = $$;
		const isMultipleX = $$.isMultipleX();
		const selector = hasRadar ? `.${CLASS.axis}-${index} text` : `.${isMultipleX ? CLASS.eventRect : `${CLASS.eventRect}-${index}`}`;
		const eventRect = (hasRadar ? radar.axes : main).select(selector).node();

		const {width, left, top} = eventRect.getBoundingClientRect();
		const x = left + (mouse ? mouse[0] : 0) + (
			isMultipleX || $$.config.axis_rotated ? 0 : (width / 2)
		);
		const y = top + (mouse ? mouse[1] : 0);
		const params = {
			screenX: x,
			screenY: y,
			clientX: x,
			clientY: y
		};

		emulateEvent[/^(mouse|click)/.test(type) ? "mouse" : "touch"](eventRect, type, params);
	}
};
