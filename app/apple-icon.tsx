import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 38,
        background: "#202020",
      }}
    >
      <div
        style={{
          width: 116,
          height: 116,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 27,
          background: "#ffffff",
        }}
      >
        <div style={{ width: 60, height: 60, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: "#202020" }} />
            <span style={{ width: 16, height: 16, borderRadius: 8, background: "#202020" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: "#202020" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: "#202020" }} />
            <span style={{ width: 16, height: 16, borderRadius: 8, background: "#202020" }} />
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
