#version 300 es
precision highp float;
precision highp int;

in vec4 position;

void main() {
    gl_Position = vec4(position.x, position.y, 0., 1.0);
}
