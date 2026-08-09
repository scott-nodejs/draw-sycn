import type { TLAssetStore } from 'tldraw'

export const syncAssetStore: TLAssetStore = {
  async upload(asset) {
    // Production path: upload files to Qiniu Kodo and return a public or signed URL.
    return { src: asset.props.src ?? '' }
  },
  resolve(asset) {
    return asset.props.src
  },
}
