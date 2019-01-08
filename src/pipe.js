import FifoSampleBuffer from './buffer.js'

export default class AbstractFifoSamplePipe {
  constructor (createBuffers) {
    if (createBuffers) {
      this.inputBuffer = new FifoSampleBuffer()
      this.outputBuffer = new FifoSampleBuffer()
    } else {
      this.inputBuffer = this.outputBuffer = null
    }
  }

  get inputBuffer () {
    return this._inputBuffer
  }

  set inputBuffer (inputBuffer) {
    this._inputBuffer = inputBuffer
  }

  get outputBuffer () {
    return this._outputBuffer
  }

  set outputBuffer (outputBuffer) {
    this._outputBuffer = outputBuffer
  }

  clear () {
    this._inputBuffer.clear()
    this._outputBuffer.clear()
  }
}