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

function getWebAudioNode (context, filter, bufSize) {
  const BUFFER_SIZE = bufSize || 1024
  const node = context.createScriptProcessor
    ? context.createScriptProcessor(BUFFER_SIZE, 2, 2)
    : context.createJavascriptNode(BUFFER_SIZE, 2, 2)
  
 

  node.onaudioprocess = function (e) {
    const inputLeft = e.inputBuffer.getChannelData(0)
    const inputRight = e.inputBuffer.getChannelData(1)
    const outputLeft = e.outputBuffer.getChannelData(0)
    const outputRight = e.outputBuffer.getChannelData(1)
    const samples = new Float32Array(BUFFER_SIZE * 2)
    // console.time('record:');
    const framesExtracted = filter.extract([inputLeft, inputRight], samples, BUFFER_SIZE)
    // const framesExtracted = 8192
    if (framesExtracted === 0) {
      node.disconnect() // Pause.
    }

    for (let i = 0; i < framesExtracted; i++) {
      outputLeft[i] = samples[i * 2]
      // outputLeft[i] = inputLeft[i]
      outputRight[i] = samples[i * 2 + 1]
      // outputRight[i] = inputRight[i]
    }
    
    // console.timeEnd('record:');
  }
  return node
}

function extendBufferSouce (sourceSound) {
  sourceSound.extract = function (originSamples, target, numFrames, position) {
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
    const ru = Math.min(numFrames, l.length - position)
    // console.log(numFrames);
    return ru
  }

  sourceSound.extract = function (originSamples, target, numFrames, position) {
    const l = originSamples[0]
    let r
    if (this.buffer.numberOfChannels > 1) {
      r = originSamples[1]
    }
    for (let i = 0; i < numFrames; i++) {
      target[i * 2] = l[i]
      if (this.buffer.numberOfChannels > 1) {
        target[i * 2 + 1] = r[i]
      }
    }

    return numFrames
  }

  return sourceSound
}

export default class PitchShifter {
  constructor (ctx, buffer, bufSize) {
    this._st = new SoundTouch()
    // this._f = new SimpleFilter(new WebAudioBufferSource(buffer), this._st)
    this._f = new SimpleFilter(extendBufferSouce(buffer), this._st)
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