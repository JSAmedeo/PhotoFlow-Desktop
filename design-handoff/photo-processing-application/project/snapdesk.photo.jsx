// Photo component: real before/after pair supplied by the user.
// - variant="before"  → original JPEG
// - variant="after"   → background-removed PNG (transparent), with a soft
//                       contact shadow under subjects.

const FAMILY_BEFORE = "assets/family-original.jpg";
const FAMILY_AFTER  = "assets/family-cutout.png";

const PhotoSVG = ({ variant="before", w=820, h=540, style }) => {
  const isAfter = variant === "after";
  const src = isAfter ? FAMILY_AFTER : FAMILY_BEFORE;

  const filter = isAfter
    ? "saturate(1.15) contrast(1.08) brightness(1.04)"
    : "saturate(0.98) contrast(1.0)";

  return (
    <div style={{
      position: "relative",
      width: typeof w === "number" ? `${w}px` : w,
      height: typeof h === "number" ? `${h}px` : h,
      overflow: "hidden",
      ...style,
    }}>
      <img
        src={src}
        alt={isAfter ? "Family — background removed" : "Family at zoo entrance"}
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center center",
          filter,
        }}
      />
      {!isAfter && (
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.32) 100%)",
        }}/>
      )}
      {isAfter && (
        <div style={{
          position:"absolute", left:"34%", right:"18%", bottom:"4%", height:"3%",
          background:"radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.32), rgba(0,0,0,0) 70%)",
          pointerEvents:"none",
        }}/>
      )}
    </div>
  );
};

window.PhotoSVG = PhotoSVG;
