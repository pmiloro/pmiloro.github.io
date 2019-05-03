#version 300 es
precision highp float;
precision highp int;

in vec4 position;

uniform float screenWidth;
uniform float screenHeight;

uniform vec2 center;
uniform float zoom;

out float screenW;
out float screenH;

out vec2 Center;
out float Zoom;

void main() {
    Center = center;
    Zoom = zoom;

    screenW = screenWidth;
    screenH = screenHeight;

    gl_Position = vec4(position.x, position.y, 0., 1.0);
}
