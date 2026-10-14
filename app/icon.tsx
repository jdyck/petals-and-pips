import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 110,
        background: "#202020",
      }}
    >
      <div
        style={{
          width: 330,
          height: 330,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 74,
          background: "#ffffff",
        }}
      >
        <div style={{ width: 176, height: 176, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#202020" }} />
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#202020" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#202020" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#202020" }} />
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#202020" }} />
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
