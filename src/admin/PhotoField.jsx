import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Modal } from '../ui.jsx'
import { api, uploadPhotos } from '../lib/api.js'
import { asset, cn } from '../lib/utils.js'

/**
 * Multi-photo picker for a dish.
 *
 * Uploads go to the server (`/api/admin/uploads`), so a photo taken on a phone
 * works just as well as one from the library. The first photo is the cover and
 * is what customers see on the menu card.
 */
export function PhotoField({ value = [], onChange, onError, max = 8 }) {
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [media, setMedia] = useState(null)
  const [drag, setDrag] = useState(false)
  const input = useRef(null)

  const photos = value.filter(Boolean)

  const loadMedia = useCallback(async () => {
    try { setMedia(await api.get('/admin/media')) } catch { setMedia({ library: [], uploads: [] }) }
  }, [])

  useEffect(() => { loadMedia() }, [loadMedia])

  const commit = (next) => onChange(next.slice(0, max))

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f && f.type.startsWith('image/'))
    if (!files.length) {
      onError?.('Pick an image file — JPG, PNG, WebP or GIF')
      return
    }
    if (photos.length + files.length > max) {
      onError?.(`A dish can have up to ${max} photos`)
      return
    }
    setUploading(true)
    try {
      const saved = await uploadPhotos(files)
      commit([...photos, ...saved.map((f) => f.path)])
      await loadMedia()
    } catch (e) {
      onError?.(e.message)
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const move = (i, dir) => {
    const next = [...photos]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }

  const makeCover = (i) => {
    if (i === 0) return
    commit([photos[i], ...photos.filter((_, k) => k !== i)])
  }

  const drop = (e) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div className="field">
      <span className="flabel">Photos</span>
      <div
        className={cn('pf', drag && 'is-drag')}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={drop}
      >
        <div className="pf-grid">
          {photos.map((src, i) => (
            <figure className="pf-tile" key={`${src}-${i}`}>
              <img src={asset(src)} alt="" loading="lazy" />
              {i === 0 && <figcaption className="pf-cover">Cover</figcaption>}
              <div className="pf-acts">
                {i > 0 && (
                  <button type="button" title="Make cover" onClick={() => makeCover(i)} aria-label="Make cover">
                    <Icon name="star" size={12} />
                  </button>
                )}
                {i > 0 && (
                  <button type="button" title="Move earlier" onClick={() => move(i, -1)} aria-label="Move earlier">←</button>
                )}
                {i < photos.length - 1 && (
                  <button type="button" title="Move later" onClick={() => move(i, 1)} aria-label="Move later">→</button>
                )}
                <button
                  type="button"
                  className="danger"
                  title="Remove photo"
                  onClick={() => commit(photos.filter((_, k) => k !== i))}
                  aria-label="Remove photo"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            </figure>
          ))}

          {photos.length < max && (
            <button
              type="button"
              className="pf-add"
              onClick={() => input.current?.click()}
              disabled={uploading}
            >
              {uploading ? <span className="spinner" /> : <><Icon name="plus" size={16} /><span>Upload</span></>}
            </button>
          )}
        </div>

        <div className="pf-foot">
          <button type="button" className="linkbtn" onClick={() => setPicking(true)}>
            Choose from library ({((media?.library || []).length)})
          </button>
          <span className="pf-drop">or drop images here</span>
          <span className="sp" />
          <span className="muted xs">{photos.length}/{max}</span>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      <span className="hint">
        {photos.length
          ? 'The first photo is the cover. Drag to reorder, or use the arrows.'
          : 'Add at least one photo — it appears on the menu card.'}
      </span>

      {picking && (
        <LibraryPicker
          media={media}
          used={photos}
          max={max - photos.length}
          onClose={() => setPicking(false)}
          onPick={(paths) => {
            commit([...photos, ...paths])
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

function LibraryPicker({ media, used, max, onPick, onClose }) {
  const [picked, setPicked] = useState([])
  const groups = [
    { key: 'uploads', title: 'Uploaded', list: media?.uploads || [] },
    { key: 'library', title: 'Built in', list: media?.library || [] },
  ]

  const toggle = (p) => {
    if (used.includes(p)) return
    setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : cur.length >= max ? cur : [...cur, p]))
  }

  return (
    <Modal open onClose={onClose} className="lib-modal" labelledBy="lib-title">
      <div className="om-head">
        <h3 id="lib-title">Choose photos</h3>
        <button type="button" className="x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
      </div>

      <div className="om-body lib-body">
        {groups.map((g) => (
          <section key={g.key}>
            <h5>{g.title} <span className="muted xs">{g.list.length}</span></h5>
            {g.list.length === 0 ? (
              <p className="muted xs">Nothing here yet.</p>
            ) : (
              <div className="lib-grid">
                {g.list.map((p) => {
                  const taken = used.includes(p)
                  const on = picked.includes(p)
                  return (
                    <button
                      type="button"
                      key={p}
                      className={cn('lib-tile', on && 'on', taken && 'taken')}
                      onClick={() => toggle(p)}
                      disabled={taken}
                      title={taken ? 'Already on this dish' : p}
                    >
                      <img src={asset(p)} alt="" loading="lazy" />
                      {on && <span className="lib-check"><Icon name="check" size={13} /></span>}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="om-foot">
        <button type="button" className="btn o sm" onClick={onClose}>Cancel</button>
        <div className="sp" />
        <button type="button" className="btn y" disabled={!picked.length} onClick={() => onPick(picked)}>
          Add {picked.length || ''}
        </button>
      </div>
    </Modal>
  )
}
