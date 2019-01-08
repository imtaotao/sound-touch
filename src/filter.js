export default class SimpleFilter {
  constructor (sourceSound, pipe) {
    this._pipe = pipe
    this.sourceSound = sourceSound
    this.historyBufferSize = 22050
    this._sourcePosition = 0
    this.outputBufferPosition = 0
    this._position = 0
  }

  get pipe () {
    return this._pipe
  }

  get inputBuffer () {
    return this._pipe.inputBuffer
  }

  get outputBuffer () {
    return this._pipe.outputBuffer
  }

  get position () {
    return this._position
  }

  set position (position) {
    if (position > this._position) {
      throw new RangeError('New position may not be greater than current position')
    }
    const newOutputBufferPosition = this.outputBufferPosition - (this._position - position)
    if (newOutputBufferPosition < 0) {
      throw new RangeError('New position falls outside of history buffer')
    }
    this.outputBufferPosition = newOutputBufferPosition
    this._position = position
  }

  get sourcePosition() {
    return this._sourcePosition
  }

  set sourcePosition(sourcePosition) {
    this.clear()
    this._sourcePosition = sourcePosition
  }

  fillInputBuffer (numFrames) {
    const samples = new Float32Array(numFrames * 2)
    const numFramesExtracted = this.sourceSound.extract(samples, numFrames, this._sourcePosition)
    this._sourcePosition += numFramesExtracted
    this.inputBuffer.putSamples(samples, 0, numFramesExtracted)
  }

  fillOutputBuffer (numFrames) {
    while (this.outputBuffer.frameCount < numFrames) {
      // TODO hardcoded buffer size
      const numInputFrames = (8192 * 2) - this.inputBuffer.frameCount

      this.fillInputBuffer(numInputFrames)

      if (this.inputBuffer.frameCount < (8192 * 2)) {
        break
        // TODO flush pipe
      }
      this._pipe.process()
    }
  }

  extract (target, numFrames) {
    this.fillOutputBuffer(this.outputBufferPosition + numFrames)

    const numFramesExtracted = Math.min(numFrames, this.outputBuffer.frameCount - this.outputBufferPosition)
    this.outputBuffer.extract(target, this.outputBufferPosition, numFramesExtracted)

    const currentFrames = this.outputBufferPosition + numFramesExtracted
    this.outputBufferPosition = Math.min(this.historyBufferSize, currentFrames)
    this.outputBuffer.receive(Math.max(currentFrames - this.historyBufferSize, 0))

    this._position += numFramesExtracted
    return numFramesExtracted
  }

  handleSampleData (e) {
    this.extract(e.data, 4096)
  }

  clear () {
    // TODO yuck
    this._pipe.clear()
    this.outputBufferPosition = 0
  }
}