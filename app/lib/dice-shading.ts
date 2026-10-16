export type DiceShading = {
  topWhite: number;
  shadowDarkness: number;
  shadowTint: string;
  surfaceColor?: string;
};

export const DEFAULT_DICE_SHADING = {
  topWhite: 1,
  shadowDarkness: 0.25,
  shadowTint: "#dbe4f2",
  surfaceColor: "#ffffff",
} satisfies DiceShading;

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

// Match the shader's face colors in the CSS fallback.
export function diceSurfaceColor(style: DiceShading, upward: number, lighting: number) {
  const t = Math.max(0, Math.min(1, upward / 0.95));
  const top = t * t * (3 - 2 * t);
  const detail = (0.82 + 0.18 * Math.max(0, Math.min(1, lighting))) * (1 - top) + top;
  const surface = style.surfaceColor ? rgb(style.surfaceColor) : [1, 1, 1];
  return "#" + rgb(style.shadowTint).map((channel, index) => {
    const shadow = channel * (1 - style.shadowDarkness);
    return Math.round(Math.max(0, Math.min(1, (shadow * (1 - top) + surface[index] * style.topWhite * top) * detail)) * 255).toString(16).padStart(2, "0");
  }).join("");
}

// Recolor the shell by its world-facing normal after tone mapping. Pips keep
// their physical material; the top uses the selected surface color or white.
export function createDiceShading() {
  const uniforms = {
    diceStyled: { value: false },
    diceTopWhite: { value: DEFAULT_DICE_SHADING.topWhite },
    diceSurfaceColor: { value: [1, 1, 1] },
    diceShadowDarkness: { value: DEFAULT_DICE_SHADING.shadowDarkness },
    diceShadowTint: { value: rgb(DEFAULT_DICE_SHADING.shadowTint) },
  };
  return {
    update(style?: DiceShading) {
      uniforms.diceStyled.value = !!style;
      if (!style) return;
      uniforms.diceTopWhite.value = style.topWhite;
      uniforms.diceSurfaceColor.value = style.surfaceColor ? rgb(style.surfaceColor) : [1, 1, 1];
      uniforms.diceShadowDarkness.value = style.shadowDarkness;
      uniforms.diceShadowTint.value = rgb(style.shadowTint);
    },
    onBeforeCompile(shader: { uniforms: Record<string, { value: unknown }>; fragmentShader: string }) {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = `
        uniform bool diceStyled;
        uniform float diceTopWhite;
        uniform vec3 diceSurfaceColor;
        uniform float diceShadowDarkness;
        uniform vec3 diceShadowTint;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <colorspace_fragment>", `
        #include <colorspace_fragment>
        if (diceStyled) {
          vec3 diceUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
          float diceTop = smoothstep(0.0, 0.95, dot(normal, diceUp));
          float diceLuma = clamp(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
          float diceDetail = mix(0.82 + 0.18 * diceLuma, 1.0, diceTop);
          vec3 diceShadow = diceShadowTint * (1.0 - diceShadowDarkness);
          gl_FragColor.rgb = mix(diceShadow, diceSurfaceColor * diceTopWhite, diceTop) * diceDetail;
        }
      `);
    },
  };
}
