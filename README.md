# 说明
音频时间拉伸和音高变换库。基于 [SoundTouch](ttp://www.surina.net/soundtouch) 的 C++ 实现，他的 js 实现最早由 [Ryan Berdeen](https://github.com/also/soundtouch-js) 实现，此处重新封装为 es module，用于满足 [hearken](https://github.com/imtaotao/hearken) 的功能需求

# 为何要用到
原生 webaudio 的速率与音高混合在一起，[暂时](https://github.com/WebAudio/web-audio-api/issues/723)没有办法分离，对于需要这方面功能的需求，可以用此库解决

# 运行 demo
需要启动一个静态服务器来支持 es module，这里使用 http-server 这个包

1. npm i http-server -g (如果安装过可以忽略)
2. 进入到当前项目目录
3. http-server -o