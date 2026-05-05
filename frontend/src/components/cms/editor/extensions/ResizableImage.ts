import Image from '@tiptap/extension-image'

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: element => element.style.width || element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return {
            style: `width: ${attributes.width}; height: auto; transition: width 0.2s ease-in-out;`,
          }
        },
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => {
          return {
            'data-align': attributes.align,
            class: `image-align-${attributes.align}`,
          }
        },
      },
    }
  },
})
