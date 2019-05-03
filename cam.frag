#version 300 es
precision highp float;
precision highp int;


out vec4 outColor;

in float screenW;
in float screenH;

in float Zoom;
in vec2 Center;

uniform sampler2D tex;

void main() {
    vec2 texCoord = gl_FragCoord.xy;
    ivec2 texelCoord;

    float sW = float(screenW);
    float sH = float(screenH);

    texCoord.x = (texCoord.x - 0.5 - 0.5 * sW)/Zoom + Center.x * sW;
    texCoord.y = (texCoord.y - 0.5 - 0.5 * sH)/Zoom + Center.y * sH;

    texelCoord.x = int(floor(texCoord.x));
    texelCoord.y = int(floor(texCoord.y));
    outColor = texelFetch(tex, texelCoord, 0);
}

