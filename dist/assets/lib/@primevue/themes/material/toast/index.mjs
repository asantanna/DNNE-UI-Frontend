var index = {
  root: {
    width: '25rem',
    borderRadius: '{content.border.radius}',
    borderWidth: '0',
    transitionDuration: '{transition.duration}'
  },
  icon: {
    size: '1.25rem'
  },
  content: {
    padding: '{overlay.popover.padding}',
    gap: '0.5rem'
  },
  text: {
    gap: '0.5rem'
  },
  summary: {
    fontWeight: '500',
    fontSize: '1rem'
  },
  detail: {
    fontWeight: '500',
    fontSize: '0.875rem'
  },
  closeButton: {
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    focusRing: {
      width: '{focus.ring.width}',
      style: '{focus.ring.style}',
      offset: '{focus.ring.offset}'
    }
  },
  closeIcon: {
    size: '1rem'
  },
  colorScheme: {
    light: {
      blur: '0',
      info: {
        background: '{blue.50}',
        borderColor: '{blue.200}',
        color: '{blue.600}',
        detailColor: '{surface.700}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{blue.100}',
          focusRing: {
            color: '{blue.600}',
            shadow: 'none'
          }
        }
      },
      success: {
        background: '{green.50}',
        borderColor: '{green.200}',
        color: '{green.600}',
        detailColor: '{surface.700}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{green.100}',
          focusRing: {
            color: '{green.600}',
            shadow: 'none'
          }
        }
      },
      warn: {
        background: '{yellow.50}',
        borderColor: '{yellow.200}',
        color: '{yellow.900}',
        detailColor: '{surface.700}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{yellow.100}',
          focusRing: {
            color: '{yellow.600}',
            shadow: 'none'
          }
        }
      },
      error: {
        background: '{red.50}',
        borderColor: '{red.200}',
        color: '{red.600}',
        detailColor: '{surface.700}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{red.100}',
          focusRing: {
            color: '{red.600}',
            shadow: 'none'
          }
        }
      },
      secondary: {
        background: '{surface.100}',
        borderColor: '{surface.200}',
        color: '{surface.600}',
        detailColor: '{surface.700}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{surface.200}',
          focusRing: {
            color: '{surface.600}',
            shadow: 'none'
          }
        }
      },
      contrast: {
        background: '{surface.900}',
        borderColor: '{surface.950}',
        color: '{surface.50}',
        detailColor: '{surface.0}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{surface.800}',
          focusRing: {
            color: '{surface.50}',
            shadow: 'none'
          }
        }
      }
    },
    dark: {
      blur: '10px',
      info: {
        background: 'color-mix(in srgb, {blue.500}, transparent 36%)',
        borderColor: 'color-mix(in srgb, {blue.700}, transparent 64%)',
        color: '{surface.0}',
        detailColor: '{blue.100}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: 'rgba(255, 255, 255, 0.05)',
          focusRing: {
            color: '{blue.500}',
            shadow: 'none'
          }
        }
      },
      success: {
        background: 'color-mix(in srgb, {green.500}, transparent 36%)',
        borderColor: 'color-mix(in srgb, {green.700}, transparent 64%)',
        color: '{surface.0}',
        detailColor: '{green.100}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: 'rgba(255, 255, 255, 0.05)',
          focusRing: {
            color: '{green.500}',
            shadow: 'none'
          }
        }
      },
      warn: {
        background: 'color-mix(in srgb, {yellow.500}, transparent 36%)',
        borderColor: 'color-mix(in srgb, {yellow.700}, transparent 64%)',
        color: '{surface.0}',
        detailColor: '{yellow.50}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: 'rgba(255, 255, 255, 0.05)',
          focusRing: {
            color: '{yellow.500}',
            shadow: 'none'
          }
        }
      },
      error: {
        background: 'color-mix(in srgb, {red.500}, transparent 36%)',
        borderColor: 'color-mix(in srgb, {red.700}, transparent 64%)',
        color: '{surface.0}',
        detailColor: '{red.100}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: 'rgba(255, 255, 255, 0.05)',
          focusRing: {
            color: '{red.500}',
            shadow: 'none'
          }
        }
      },
      secondary: {
        background: '{surface.800}',
        borderColor: '{surface.700}',
        color: '{surface.300}',
        detailColor: '{surface.0}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{surface.700}',
          focusRing: {
            color: '{surface.300}',
            shadow: 'none'
          }
        }
      },
      contrast: {
        background: '{surface.0}',
        borderColor: '{surface.100}',
        color: '{surface.950}',
        detailColor: '{surface.950}',
        shadow: '0px 3px 5px -1px rgba(0, 0, 0, 0.2), 0px 6px 10px 0px rgba(0, 0, 0, 0.14), 0px 1px 18px 0px rgba(0, 0, 0, 0.12)',
        closeButton: {
          hoverBackground: '{surface.100}',
          focusRing: {
            color: '{surface.950}',
            shadow: 'none'
          }
        }
      }
    }
  }
};

export { index as default };
//# sourceMappingURL=index.mjs.map
