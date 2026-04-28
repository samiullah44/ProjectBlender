export interface ContentBlock {
  type: string
  attrs?: Record<string, any>
  content?: ContentBlock[]
  text?: string
  marks?: { type: string; attrs?: Record<string, any> }[]
}
