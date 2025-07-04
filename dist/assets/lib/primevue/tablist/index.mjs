import { getWidth, isRTL, findSingle, getOuterHeight, getOffset, getOuterWidth, getHeight } from '@primeuix/utils/dom';
import ChevronLeftIcon from '@primevue/icons/chevronleft';
import ChevronRightIcon from '@primevue/icons/chevronright';
import Ripple from 'primevue/ripple';
import BaseComponent from '@primevue/core/basecomponent';
import TabListStyle from 'primevue/tablist/style';
import { resolveDirective, openBlock, createElementBlock, mergeProps, withDirectives, createBlock, resolveDynamicComponent, createCommentVNode, createElementVNode, renderSlot } from 'vue';

var script$1 = {
  name: 'BaseTabList',
  "extends": BaseComponent,
  props: {},
  style: TabListStyle,
  provide: function provide() {
    return {
      $pcTabList: this,
      $parentInstance: this
    };
  }
};

var script = {
  name: 'TabList',
  "extends": script$1,
  inheritAttrs: false,
  inject: ['$pcTabs'],
  data: function data() {
    return {
      isPrevButtonEnabled: false,
      isNextButtonEnabled: true
    };
  },
  resizeObserver: undefined,
  watch: {
    showNavigators: function showNavigators(newValue) {
      newValue ? this.bindResizeObserver() : this.unbindResizeObserver();
    },
    activeValue: {
      flush: 'post',
      handler: function handler() {
        this.updateInkBar();
      }
    }
  },
  mounted: function mounted() {
    var _this = this;
    this.$nextTick(function () {
      _this.updateInkBar();
    });
    if (this.showNavigators) {
      this.updateButtonState();
      this.bindResizeObserver();
    }
  },
  updated: function updated() {
    this.showNavigators && this.updateButtonState();
  },
  beforeUnmount: function beforeUnmount() {
    this.unbindResizeObserver();
  },
  methods: {
    onScroll: function onScroll(event) {
      this.showNavigators && this.updateButtonState();
      event.preventDefault();
    },
    onPrevButtonClick: function onPrevButtonClick() {
      var content = this.$refs.content;
      var buttonWidths = this.getVisibleButtonWidths();
      var width = getWidth(content) - buttonWidths;
      var currentScrollLeft = Math.abs(content.scrollLeft);
      var scrollStep = width * 0.8;
      var targetScrollLeft = currentScrollLeft - scrollStep;
      var scrollLeft = Math.max(targetScrollLeft, 0);
      content.scrollLeft = isRTL(content) ? -1 * scrollLeft : scrollLeft;
    },
    onNextButtonClick: function onNextButtonClick() {
      var content = this.$refs.content;
      var buttonWidths = this.getVisibleButtonWidths();
      var width = getWidth(content) - buttonWidths;
      var currentScrollLeft = Math.abs(content.scrollLeft);
      var scrollStep = width * 0.8;
      var targetScrollLeft = currentScrollLeft + scrollStep;
      var maxScrollLeft = content.scrollWidth - width;
      var scrollLeft = Math.min(targetScrollLeft, maxScrollLeft);
      content.scrollLeft = isRTL(content) ? -1 * scrollLeft : scrollLeft;
    },
    bindResizeObserver: function bindResizeObserver() {
      var _this2 = this;
      this.resizeObserver = new ResizeObserver(function () {
        return _this2.updateButtonState();
      });
      this.resizeObserver.observe(this.$refs.list);
    },
    unbindResizeObserver: function unbindResizeObserver() {
      var _this$resizeObserver;
      (_this$resizeObserver = this.resizeObserver) === null || _this$resizeObserver === void 0 || _this$resizeObserver.unobserve(this.$refs.list);
      this.resizeObserver = undefined;
    },
    updateInkBar: function updateInkBar() {
      var _this$$refs = this.$refs,
        content = _this$$refs.content,
        inkbar = _this$$refs.inkbar,
        tabs = _this$$refs.tabs;
      var activeTab = findSingle(content, '[data-pc-name="tab"][data-p-active="true"]');
      if (this.$pcTabs.isVertical()) {
        inkbar.style.height = getOuterHeight(activeTab) + 'px';
        inkbar.style.top = getOffset(activeTab).top - getOffset(tabs).top + 'px';
      } else {
        inkbar.style.width = getOuterWidth(activeTab) + 'px';
        inkbar.style.left = getOffset(activeTab).left - getOffset(tabs).left + 'px';
      }
    },
    updateButtonState: function updateButtonState() {
      var _this$$refs2 = this.$refs,
        list = _this$$refs2.list,
        content = _this$$refs2.content;
      var scrollTop = content.scrollTop,
        scrollWidth = content.scrollWidth,
        scrollHeight = content.scrollHeight,
        offsetWidth = content.offsetWidth,
        offsetHeight = content.offsetHeight;
      var scrollLeft = Math.abs(content.scrollLeft);
      var _ref = [getWidth(content), getHeight(content)],
        width = _ref[0],
        height = _ref[1];
      if (this.$pcTabs.isVertical()) {
        this.isPrevButtonEnabled = scrollTop !== 0;
        this.isNextButtonEnabled = list.offsetHeight >= offsetHeight && parseInt(scrollTop) !== scrollHeight - height;
      } else {
        this.isPrevButtonEnabled = scrollLeft !== 0;
        this.isNextButtonEnabled = list.offsetWidth >= offsetWidth && parseInt(scrollLeft) !== scrollWidth - width;
      }
    },
    getVisibleButtonWidths: function getVisibleButtonWidths() {
      var _this$$refs3 = this.$refs,
        prevButton = _this$$refs3.prevButton,
        nextButton = _this$$refs3.nextButton;
      var width = 0;
      if (this.showNavigators) {
        width = ((prevButton === null || prevButton === void 0 ? void 0 : prevButton.offsetWidth) || 0) + ((nextButton === null || nextButton === void 0 ? void 0 : nextButton.offsetWidth) || 0);
      }
      return width;
    }
  },
  computed: {
    templates: function templates() {
      return this.$pcTabs.$slots;
    },
    activeValue: function activeValue() {
      return this.$pcTabs.d_value;
    },
    showNavigators: function showNavigators() {
      return this.$pcTabs.scrollable && this.$pcTabs.showNavigators;
    },
    prevButtonAriaLabel: function prevButtonAriaLabel() {
      return this.$primevue.config.locale.aria ? this.$primevue.config.locale.aria.previous : undefined;
    },
    nextButtonAriaLabel: function nextButtonAriaLabel() {
      return this.$primevue.config.locale.aria ? this.$primevue.config.locale.aria.next : undefined;
    }
  },
  components: {
    ChevronLeftIcon: ChevronLeftIcon,
    ChevronRightIcon: ChevronRightIcon
  },
  directives: {
    ripple: Ripple
  }
};

var _hoisted_1 = ["aria-label", "tabindex"];
var _hoisted_2 = ["aria-orientation"];
var _hoisted_3 = ["aria-label", "tabindex"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
  var _directive_ripple = resolveDirective("ripple");
  return openBlock(), createElementBlock("div", mergeProps({
    ref: "list",
    "class": _ctx.cx('root')
  }, _ctx.ptmi('root')), [$options.showNavigators && $data.isPrevButtonEnabled ? withDirectives((openBlock(), createElementBlock("button", mergeProps({
    key: 0,
    ref: "prevButton",
    "class": _ctx.cx('prevButton'),
    "aria-label": $options.prevButtonAriaLabel,
    tabindex: $options.$pcTabs.tabindex,
    onClick: _cache[0] || (_cache[0] = function () {
      return $options.onPrevButtonClick && $options.onPrevButtonClick.apply($options, arguments);
    })
  }, _ctx.ptm('prevButton'), {
    "data-pc-group-section": "navigator"
  }), [(openBlock(), createBlock(resolveDynamicComponent($options.templates.previcon || 'ChevronLeftIcon'), mergeProps({
    "aria-hidden": "true"
  }, _ctx.ptm('prevIcon')), null, 16))], 16, _hoisted_1)), [[_directive_ripple]]) : createCommentVNode("", true), createElementVNode("div", mergeProps({
    ref: "content",
    "class": _ctx.cx('content'),
    onScroll: _cache[1] || (_cache[1] = function () {
      return $options.onScroll && $options.onScroll.apply($options, arguments);
    })
  }, _ctx.ptm('content')), [createElementVNode("div", mergeProps({
    ref: "tabs",
    "class": _ctx.cx('tabList'),
    role: "tablist",
    "aria-orientation": $options.$pcTabs.orientation || 'horizontal'
  }, _ctx.ptm('tabList')), [renderSlot(_ctx.$slots, "default"), createElementVNode("span", mergeProps({
    ref: "inkbar",
    "class": _ctx.cx('activeBar'),
    role: "presentation",
    "aria-hidden": "true"
  }, _ctx.ptm('activeBar')), null, 16)], 16, _hoisted_2)], 16), $options.showNavigators && $data.isNextButtonEnabled ? withDirectives((openBlock(), createElementBlock("button", mergeProps({
    key: 1,
    ref: "nextButton",
    "class": _ctx.cx('nextButton'),
    "aria-label": $options.nextButtonAriaLabel,
    tabindex: $options.$pcTabs.tabindex,
    onClick: _cache[2] || (_cache[2] = function () {
      return $options.onNextButtonClick && $options.onNextButtonClick.apply($options, arguments);
    })
  }, _ctx.ptm('nextButton'), {
    "data-pc-group-section": "navigator"
  }), [(openBlock(), createBlock(resolveDynamicComponent($options.templates.nexticon || 'ChevronRightIcon'), mergeProps({
    "aria-hidden": "true"
  }, _ctx.ptm('nextIcon')), null, 16))], 16, _hoisted_3)), [[_directive_ripple]]) : createCommentVNode("", true)], 16);
}

script.render = render;

export { script as default };
//# sourceMappingURL=index.mjs.map
