var index = {
  toolbar: {
    background: '{content.background}',
    borderColor: '{content.border.color}',
    borderRadius: '{content.border.radius}'
  },
  toolbarItem: {
    color: '{text.muted.color}',
    hoverColor: '{text.color}',
    activeColor: '{primary.color}'
  },
  overlay: {
    background: '{overlay.select.background}',
    borderColor: '{overlay.select.border.color}',
    borderRadius: '{overlay.select.border.radius}',
    color: '{overlay.select.color}',
    shadow: '{overlay.select.shadow}',
    padding: '{list.padding}'
  },
  overlayOption: {
    focusBackground: '{list.option.focus.background}',
    color: '{list.option.color}',
    focusColor: '{list.option.focus.color}',
    padding: '{list.option.padding}',
    borderRadius: '{list.option.border.radius}'
  },
  content: {
    background: '{content.background}',
    borderColor: '{content.border.color}',
    color: '{content.color}',
    borderRadius: '{content.border.radius}'
  },
  css: function css(_ref) {
    _ref.dt;
    return "\n.p-editor .p-editor-toolbar {\n    padding: 0.75rem\n}\n";
  }
};

export { index as default };
//# sourceMappingURL=index.mjs.map
