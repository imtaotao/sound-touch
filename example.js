import PitchShifter from './src/index.js'

//AC polyfill
window.AudioContext = window.AudioContext ||
  window.webkitAudioContext ||
  window.mozAudioContext ||
  window.oAudioContext ||
  window.msAudioContext

  
var context = new AudioContext();
window.ac = context

var pitchshifter, buffer;
context.resume();
//GET AUDIO FILE
var request = new XMLHttpRequest();
request.open('GET', './盲点.mp3', true);
request.responseType = 'arraybuffer';

request.onload = function() {
    console.log('url loaded');
    context.decodeAudioData(request.response, function(buf) {
        //we now have the audio data
        buffer = buf;
        console.log('decoded');
        window.p = pitchshifter = new PitchShifter(context, buffer, 1024);
        pitchshifter.tempo = 1;
    });
}

console.log('reading url');
request.send();

//PLAYBACK
window.play = function play() {
    pitchshifter.connect(context.destination);
    console.log("play")
}

window.pause = function pause() {
    pitchshifter.disconnect();
}

document.getElementById('tempoSlider').addEventListener('input', function(){
    pitchshifter.tempo = this.value;
});

document.getElementById('pitchSlider').addEventListener('input', function(){
    pitchshifter.pitch = this.value;
});

document.getElementById('rateSlider').addEventListener('input', function () {
    pitchshifter.rate = this.value;
})