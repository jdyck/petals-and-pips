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
        background: "#173f42",
      }}
    >
      <div
        style={{
          width: 330,
          height: 330,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "18px solid #e3ad4e",
          borderRadius: 74,
          background: "#ce684d",
          transform: "rotate(-4deg)",
        }}
      >
        <div style={{ width: 176, height: 176, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#fff9ed" }} />
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#fff9ed" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#fff9ed" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#fff9ed" }} />
            <span style={{ width: 46, height: 46, borderRadius: 23, background: "#fff9ed" }} />
          </div>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
