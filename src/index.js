import SimpleFilter from './filter.js'
import SoundTouch from './soundtouch.js'

class WebAudioBufferSource {
  constructor (buffer) {
    this.buffer = buffer
  }
  
  extract (target, numFrames, position) {
    const l = this.buffer.getChannelData(0)
    let r
    if (this.buffer.numberOfChannels > 1) {
      r = this.buffer.getChannelData(1)
    }
    for (let i = 0; i < numFrames; i++) {
      target[i * 2] = l[i + position]
      if (this.buffer.numberOfChannels > 1) {
        target[i * 2 + 1] = r[i + position]
      }
    }
    return Math.min(numFrames, l.length - position)
  }
}

function getWebAudioNode(context, filter, bufSize) {
  const BUFFER_SIZE = bufSize || 1024
  const node = context.createScriptProcessor
    ? context.createScriptProcessor(BUFFER_SIZE, 2, 2)
    : context.createJavascriptNode(BUFFER_SIZE, 2, 2)
  
  const samples = new Float32Array(BUFFER_SIZE * 2)

  node.onaudioprocess = function (e) {
      const l = e.outputBuffer.getChannelData(0)
      const r = e.outputBuffer.getChannelData(1)
      const framesExtracted = filter.extract(samples, BUFFER_SIZE)

      if (framesExtracted === 0) {
          node.disconnect() // Pause.
      }
      for (let i = 0; i < framesExtracted; i++) {
        l[i] = samples[i * 2]
        r[i] = samples[i * 2 + 1]
      }
  }
  return node
}

export default class PitchShifter {
  constructor (ctx, buffer, bufSize) {
    this._st = new SoundTouch()
    this._f = new SimpleFilter(new WebAudioBufferSource(buffer), this._st)
    this._node = getWebAudioNode(ctx, this._f, bufSize)
  }

  get pitch () {
    return this._st.pitch
  }

  set pitch (p) {
    this._st.pitch = p
  }

  get rate () {
    return this._st.rate
  }

  set rate (r) {
    this._st.rate = r
  }
  
  get tempo () {
    return this._st.tempo
  }

  set tempo (t) {
    this._st.tempo = t
  }

  connect (toNode) {
    this._node.connect(toNode)
  }

  disconnect () {
    this._node.disconnect()
  }
}