import { getWidth, getHeight, getOuterWidth, getOuterHeight, isRTL } from '@primeuix/utils/dom';
import { isArray } from '@primeuix/utils/object';
import { getVNodeProp } from '@primevue/core/utils';
import BaseComponent from '@primevue/core/basecomponent';
import SplitterStyle from 'primevue/splitter/style';
import { openBlock, createElementBlock, mergeProps, Fragment, renderList, createBlock, resolveDynamicComponent, createElementVNode, createCommentVNode } from 'vue';

var script$1 = {
  name: 'BaseSplitter',
  "extends": BaseComponent,
  props: {
    layout: {
      type: String,
      "default": 'horizontal'
    },
    gutterSize: {
      type: Number,
      "default": 4
    },
    stateKey: {
      type: String,
      "default": null
    },
    stateStorage: {
      type: String,
      "default": 'session'
    },
    step: {
      type: Number,
      "default": 5
    }
  },
  style: SplitterStyle,
  provide: function provide() {
    return {
      $pcSplitter: this,
      $parentInstance: this
    };
  }
};

function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
var script = {
  name: 'Splitter',
  "extends": script$1,
  inheritAttrs: false,
  emits: ['resizestart', 'resizeend', 'resize'],
  dragging: false,
  mouseMoveListener: null,
  mouseUpListener: null,
  touchMoveListener: null,
  touchEndListener: null,
  size: null,
  gutterElement: null,
  startPos: null,
  prevPanelElement: null,
  nextPanelElement: null,
  nextPanelSize: null,
  prevPanelSize: null,
  panelSizes: null,
  prevPanelIndex: null,
  timer: null,
  data: function data() {
    return {
      prevSize: null
    };
  },
  mounted: function mounted() {
    this.initializePanels();
  },
  beforeUnmount: function beforeUnmount() {
    this.clear();
    this.unbindMouseListeners();
  },
  methods: {
    isSplitterPanel: function isSplitterPanel(child) {
      return child.type.name === 'SplitterPanel';
    },
    initializePanels: function initializePanels() {
      var _this = this;
      if (this.panels && this.panels.length) {
        var initialized = false;
        if (this.isStateful()) {
          initialized = this.restoreState();
        }
        if (!initialized) {
          var children = _toConsumableArray(this.$el.children).filter(function (child) {
            return child.getAttribute('data-pc-name') === 'splitterpanel';
          });
          var _panelSizes = [];
          this.panels.map(function (panel, i) {
            var panelInitialSize = panel.props && panel.props.size ? panel.props.size : null;
            var panelSize = panelInitialSize || 100 / _this.panels.length;
            _panelSizes[i] = panelSize;
            children[i].style.flexBasis = 'calc(' + panelSize + '% - ' + (_this.panels.length - 1) * _this.gutterSize + 'px)';
          });
          this.panelSizes = _panelSizes;
          this.prevSize = parseFloat(_panelSizes[0]).toFixed(4);
        }
      }
    },
    onResizeStart: function onResizeStart(event, index, isKeyDown) {
      this.gutterElement = event.currentTarget || event.target.parentElement;
      this.size = this.horizontal ? getWidth(this.$el) : getHeight(this.$el);
      if (!isKeyDown) {
        this.dragging = true;
        this.startPos = this.layout === 'horizontal' ? event.pageX || event.changedTouches[0].pageX : event.pageY || event.changedTouches[0].pageY;
      }
      this.prevPanelElement = this.gutterElement.previousElementSibling;
      this.nextPanelElement = this.gutterElement.nextElementSibling;
      if (isKeyDown) {
        this.prevPanelSize = this.horizontal ? getOuterWidth(this.prevPanelElement, true) : getOuterHeight(this.prevPanelElement, true);
        this.nextPanelSize = this.horizontal ? getOuterWidth(this.nextPanelElement, true) : getOuterHeight(this.nextPanelElement, true);
      } else {
        this.prevPanelSize = 100 * (this.horizontal ? getOuterWidth(this.prevPanelElement, true) : getOuterHeight(this.prevPanelElement, true)) / this.size;
        this.nextPanelSize = 100 * (this.horizontal ? getOuterWidth(this.nextPanelElement, true) : getOuterHeight(this.nextPanelElement, true)) / this.size;
      }
      this.prevPanelIndex = index;
      this.$emit('resizestart', {
        originalEvent: event,
        sizes: this.panelSizes
      });
      this.$refs.gutter[index].setAttribute('data-p-gutter-resizing', true);
      this.$el.setAttribute('data-p-resizing', true);
    },
    onResize: function onResize(event, step, isKeyDown) {
      var newPos, newPrevPanelSize, newNextPanelSize;
      if (isKeyDown) {
        if (this.horizontal) {
          newPrevPanelSize = 100 * (this.prevPanelSize + step) / this.size;
          newNextPanelSize = 100 * (this.nextPanelSize - step) / this.size;
        } else {
          newPrevPanelSize = 100 * (this.prevPanelSize - step) / this.size;
          newNextPanelSize = 100 * (this.nextPanelSize + step) / this.size;
        }
      } else {
        if (this.horizontal) {
          if (isRTL(this.$el)) {
            newPos = (this.startPos - event.pageX) * 100 / this.size;
          } else {
            newPos = (event.pageX - this.startPos) * 100 / this.size;
          }
        } else {
          newPos = (event.pageY - this.startPos) * 100 / this.size;
        }
        newPrevPanelSize = this.prevPanelSize + newPos;
        newNextPanelSize = this.nextPanelSize - newPos;
      }
      if (this.validateResize(newPrevPanelSize, newNextPanelSize)) {
        this.prevPanelElement.style.flexBasis = 'calc(' + newPrevPanelSize + '% - ' + (this.panels.length - 1) * this.gutterSize + 'px)';
        this.nextPanelElement.style.flexBasis = 'calc(' + newNextPanelSize + '% - ' + (this.panels.length - 1) * this.gutterSize + 'px)';
        this.panelSizes[this.prevPanelIndex] = newPrevPanelSize;
        this.panelSizes[this.prevPanelIndex + 1] = newNextPanelSize;
        this.prevSize = parseFloat(newPrevPanelSize).toFixed(4);
      }
      this.$emit('resize', {
        originalEvent: event,
        sizes: this.panelSizes
      });
    },
    onResizeEnd: function onResizeEnd(event) {
      if (this.isStateful()) {
        this.saveState();
      }
      this.$emit('resizeend', {
        originalEvent: event,
        sizes: this.panelSizes
      });
      this.$refs.gutter.forEach(function (gutter) {
        return gutter.setAttribute('data-p-gutter-resizing', false);
      });
      this.$el.setAttribute('data-p-resizing', false);
      this.clear();
    },
    repeat: function repeat(event, index, step) {
      this.onResizeStart(event, index, true);
      this.onResize(event, step, true);
    },
    setTimer: function setTimer(event, index, step) {
      var _this2 = this;
      if (!this.timer) {
        this.timer = setInterval(function () {
          _this2.repeat(event, index, step);
        }, 40);
      }
    },
    clearTimer: function clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },
    onGutterKeyUp: function onGutterKeyUp() {
      this.clearTimer();
      this.onResizeEnd();
    },
    onGutterKeyDown: function onGutterKeyDown(event, index) {
      switch (event.code) {
        case 'ArrowLeft':
          {
            if (this.layout === 'horizontal') {
              this.setTimer(event, index, this.step * -1);
            }
            event.preventDefault();
            break;
          }
        case 'ArrowRight':
          {
            if (this.layout === 'horizontal') {
              this.setTimer(event, index, this.step);
            }
            event.preventDefault();
            break;
          }
        case 'ArrowDown':
          {
            if (this.layout === 'vertical') {
              this.setTimer(event, index, this.step * -1);
            }
            event.preventDefault();
            break;
          }
        case 'ArrowUp':
          {
            if (this.layout === 'vertical') {
              this.setTimer(event, index, this.step);
            }
            event.preventDefault();
            break;
          }
      }
    },
    onGutterMouseDown: function onGutterMouseDown(event, index) {
      this.onResizeStart(event, index);
      this.bindMouseListeners();
    },
    onGutterTouchStart: function onGutterTouchStart(event, index) {
      this.onResizeStart(event, index);
      this.bindTouchListeners();
      event.preventDefault();
    },
    onGutterTouchMove: function onGutterTouchMove(event) {
      this.onResize(event);
      event.preventDefault();
    },
    onGutterTouchEnd: function onGutterTouchEnd(event) {
      this.onResizeEnd(event);
      this.unbindTouchListeners();
      event.preventDefault();
    },
    bindMouseListeners: function bindMouseListeners() {
      var _this3 = this;
      if (!this.mouseMoveListener) {
        this.mouseMoveListener = function (event) {
          return _this3.onResize(event);
        };
        document.addEventListener('mousemove', this.mouseMoveListener);
      }
      if (!this.mouseUpListener) {
        this.mouseUpListener = function (event) {
          _this3.onResizeEnd(event);
          _this3.unbindMouseListeners();
        };
        document.addEventListener('mouseup', this.mouseUpListener);
      }
    },
    bindTouchListeners: function bindTouchListeners() {
      var _this4 = this;
      if (!this.touchMoveListener) {
        this.touchMoveListener = function (event) {
          return _this4.onResize(event.changedTouches[0]);
        };
        document.addEventListener('touchmove', this.touchMoveListener);
      }
      if (!this.touchEndListener) {
        this.touchEndListener = function (event) {
          _this4.resizeEnd(event);
          _this4.unbindTouchListeners();
        };
        document.addEventListener('touchend', this.touchEndListener);
      }
    },
    validateResize: function validateResize(newPrevPanelSize, newNextPanelSize) {
      if (newPrevPanelSize > 100 || newPrevPanelSize < 0) return false;
      if (newNextPanelSize > 100 || newNextPanelSize < 0) return false;
      var prevPanelMinSize = getVNodeProp(this.panels[this.prevPanelIndex], 'minSize');
      if (this.panels[this.prevPanelIndex].props && prevPanelMinSize && prevPanelMinSize > newPrevPanelSize) {
        return false;
      }
      var newPanelMinSize = getVNodeProp(this.panels[this.prevPanelIndex + 1], 'minSize');
      if (this.panels[this.prevPanelIndex + 1].props && newPanelMinSize && newPanelMinSize > newNextPanelSize) {
        return false;
      }
      return true;
    },
    unbindMouseListeners: function unbindMouseListeners() {
      if (this.mouseMoveListener) {
        document.removeEventListener('mousemove', this.mouseMoveListener);
        this.mouseMoveListener = null;
      }
      if (this.mouseUpListener) {
        document.removeEventListener('mouseup', this.mouseUpListener);
        this.mouseUpListener = null;
      }
    },
    unbindTouchListeners: function unbindTouchListeners() {
      if (this.touchMoveListener) {
        document.removeEventListener('touchmove', this.touchMoveListener);
        this.touchMoveListener = null;
      }
      if (this.touchEndListener) {
        document.removeEventListener('touchend', this.touchEndListener);
        this.touchEndListener = null;
      }
    },
    clear: function clear() {
      this.dragging = false;
      this.size = null;
      this.startPos = null;
      this.prevPanelElement = null;
      this.nextPanelElement = null;
      this.prevPanelSize = null;
      this.nextPanelSize = null;
      this.gutterElement = null;
      this.prevPanelIndex = null;
    },
    isStateful: function isStateful() {
      return this.stateKey != null;
    },
    getStorage: function getStorage() {
      switch (this.stateStorage) {
        case 'local':
          return window.localStorage;
        case 'session':
          return window.sessionStorage;
        default:
          throw new Error(this.stateStorage + ' is not a valid value for the state storage, supported values are "local" and "session".');
      }
    },
    saveState: function saveState() {
      if (isArray(this.panelSizes)) {
        this.getStorage().setItem(this.stateKey, JSON.stringify(this.panelSizes));
      }
    },
    restoreState: function restoreState() {
      var _this5 = this;
      var storage = this.getStorage();
      var stateString = storage.getItem(this.stateKey);
      if (stateString) {
        this.panelSizes = JSON.parse(stateString);
        var children = _toConsumableArray(this.$el.children).filter(function (child) {
          return child.getAttribute('data-pc-name') === 'splitterpanel';
        });
        children.forEach(function (child, i) {
          child.style.flexBasis = 'calc(' + _this5.panelSizes[i] + '% - ' + (_this5.panels.length - 1) * _this5.gutterSize + 'px)';
        });
        return true;
      }
      return false;
    },
    resetState: function resetState() {
      this.initializePanels();
    }
  },
  computed: {
    panels: function panels() {
      var _this6 = this;
      var panels = [];
      this.$slots["default"]().forEach(function (child) {
        if (_this6.isSplitterPanel(child)) {
          panels.push(child);
        } else if (child.children instanceof Array) {
          child.children.forEach(function (nestedChild) {
            if (_this6.isSplitterPanel(nestedChild)) {
              panels.push(nestedChild);
            }
          });
        }
      });
      return panels;
    },
    gutterStyle: function gutterStyle() {
      if (this.horizontal) return {
        width: this.gutterSize + 'px'
      };else return {
        height: this.gutterSize + 'px'
      };
    },
    horizontal: function horizontal() {
      return this.layout === 'horizontal';
    },
    getPTOptions: function getPTOptions() {
      var _this$$parentInstance;
      return {
        context: {
          nested: (_this$$parentInstance = this.$parentInstance) === null || _this$$parentInstance === void 0 ? void 0 : _this$$parentInstance.nestedState
        }
      };
    }
  }
};

var _hoisted_1 = ["onMousedown", "onTouchstart", "onTouchmove", "onTouchend"];
var _hoisted_2 = ["aria-orientation", "aria-valuenow", "onKeydown"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
  return openBlock(), createElementBlock("div", mergeProps({
    "class": _ctx.cx('root'),
    style: _ctx.sx('root'),
    "data-p-resizing": false
  }, _ctx.ptmi('root', $options.getPTOptions)), [(openBlock(true), createElementBlock(Fragment, null, renderList($options.panels, function (panel, i) {
    return openBlock(), createElementBlock(Fragment, {
      key: i
    }, [(openBlock(), createBlock(resolveDynamicComponent(panel), {
      tabindex: "-1"
    })), i !== $options.panels.length - 1 ? (openBlock(), createElementBlock("div", mergeProps({
      key: 0,
      ref_for: true,
      ref: "gutter",
      "class": _ctx.cx('gutter'),
      role: "separator",
      tabindex: "-1",
      onMousedown: function onMousedown($event) {
        return $options.onGutterMouseDown($event, i);
      },
      onTouchstart: function onTouchstart($event) {
        return $options.onGutterTouchStart($event, i);
      },
      onTouchmove: function onTouchmove($event) {
        return $options.onGutterTouchMove($event, i);
      },
      onTouchend: function onTouchend($event) {
        return $options.onGutterTouchEnd($event, i);
      },
      "data-p-gutter-resizing": false
    }, _ctx.ptm('gutter')), [createElementVNode("div", mergeProps({
      "class": _ctx.cx('gutterHandle'),
      tabindex: "0",
      style: [$options.gutterStyle],
      "aria-orientation": _ctx.layout,
      "aria-valuenow": $data.prevSize,
      onKeyup: _cache[0] || (_cache[0] = function () {
        return $options.onGutterKeyUp && $options.onGutterKeyUp.apply($options, arguments);
      }),
      onKeydown: function onKeydown($event) {
        return $options.onGutterKeyDown($event, i);
      },
      ref_for: true
    }, _ctx.ptm('gutterHandle')), null, 16, _hoisted_2)], 16, _hoisted_1)) : createCommentVNode("", true)], 64);
  }), 128))], 16);
}

script.render = render;

export { script as default };
//# sourceMappingURL=index.mjs.map
