import { useState } from 'react';
import { Check as CheckIcon, AlertTriangle } from 'lucide-react';
import { Slider } from '../../components/Slider';
import { Select } from '../../components/Select';
import { Seg } from '../../components/Seg';
import { Check } from '../../components/Check';

function SectionHead({ label, count, action }: { label: string; count?: string; action?: React.ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
      <div className="uppercase">{label}</div>
      <div className="row gap-2">
        {count != null && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{count}</span>}
        {action}
      </div>
    </div>
  );
}

function LabeledSlider({ label, value, onChange, fmt }: { label: string; value: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div>
      <div className="ctrl-row">
        <span className="label">{label}</span>
        <span className="val">{fmt ? fmt(value) : value}</span>
      </div>
      <Slider value={value} onChange={onChange} />
    </div>
  );
}

export function RightPanel() {
  const [bgModel,     setBgModel]     = useState('Local Service - General Model');
  const [sensitivity, setSensitivity] = useState(72);
  const [feather,     setFeather]     = useState(18);
  const [sharp,       setSharp]       = useState(42);
  const [color,       setColor]       = useState(58);
  const [wb,          setWb]          = useState(50);
  const [denoise,     setDenoise]     = useState(34);
  const [exposure,    setExposure]    = useState(50);
  const [upscale,     setUpscale]     = useState('2×');
  const [upModel,     setUpModel]     = useState('Topaz Photo AI · Subject');
  const [autoApply,   setAutoApply]   = useState(true);
  const [enhAuto,     setEnhAuto]     = useState(true);
  const [enhModel,    setEnhModel]    = useState('Local Model - Real-ESRGAN + GFPGAN');

  return (
    <div className="panel right">
      <div className="panel-scroll grow">

        {/* Background removal */}
        <div className="panel-section">
          <SectionHead
            label="Background Removal"
            action={<Check on={autoApply} onClick={() => setAutoApply(v => !v)} label="Auto" />}
          />
          <div className="col gap-2" style={{ gap: 8 }}>
            <div>
              <div className="ctrl-row"><span className="label">Model</span><span className="val">v3.1</span></div>
              <Select
                value={bgModel}
                onChange={setBgModel}
                options={['Local Service - General Model', 'Local Service - Special Model', 'Cloud Service - RemoveBG API', 'Cloud Service - Adobe']}
              />
            </div>
            <LabeledSlider label="Sensitivity"   value={sensitivity} onChange={setSensitivity} fmt={v => `${v}%`} />
            <LabeledSlider label="Edge feather"  value={feather}     onChange={setFeather}     fmt={v => `${v} px`} />
          </div>
        </div>

        {/* Image enhancement */}
        <div className="panel-section">
          <SectionHead
            label="Image Enhancement"
            count="5 active"
            action={<Check on={enhAuto} onClick={() => setEnhAuto(v => !v)} label="Auto" />}
          />
          <div className="col" style={{ gap: 8 }}>
            <div>
              <div className="ctrl-row"><span className="label">Model</span><span className="val">v2.4</span></div>
              <Select
                value={enhModel}
                onChange={setEnhModel}
                options={['Local Model - Real-ESRGAN + GFPGAN', 'Cloud Model - Topaz']}
              />
            </div>
            <LabeledSlider label="Sharpness"        value={sharp}    onChange={setSharp}    fmt={v => `+${v - 50}`} />
            <LabeledSlider label="Color correction"  value={color}    onChange={setColor}    fmt={v => `+${v - 50}`} />
            <LabeledSlider label="White balance"     value={wb}       onChange={setWb}       fmt={v => `${v < 50 ? '-' : '+'}${Math.abs(v - 50) * 40} K`} />
            <LabeledSlider label="Exposure"          value={exposure} onChange={setExposure} fmt={v => `${v < 50 ? '-' : '+'}${(Math.abs(v - 50) / 50 * 1.8).toFixed(2)} EV`} />
            <LabeledSlider label="Denoise"           value={denoise}  onChange={setDenoise}  fmt={v => `${v}%`} />
          </div>
        </div>

        {/* Upscaling */}
        <div className="panel-section">
          <SectionHead label="Upscaling" />
          <div className="col" style={{ gap: 8 }}>
            <Seg value={upscale} onChange={setUpscale} options={['1×', '2×', '4×']} />
            <div>
              <div className="ctrl-row">
                <span className="label">Model</span>
                <span className="val">{upscale === '4×' ? '~5.2s/img' : '~1.8s/img'}</span>
              </div>
              <Select
                value={upModel}
                onChange={setUpModel}
                options={['Topaz Photo AI · Subject', 'Topaz Gigapixel · Standard', 'Real-ESRGAN · Anime', 'SwinIR · General']}
              />
            </div>
            <div className="row gap-2">
              <Check on={true}  onClick={() => {}} label="Preserve faces" />
              <Check on={false} onClick={() => {}} label="GFPGAN" />
            </div>
          </div>
        </div>

        {/* Processing queue */}
        <div className="panel-section" style={{ borderBottom: 'none' }}>
          <SectionHead label="Processing Queue" count="demo" />
          <div className="col" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>Batch · XYZ0001415</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--accent)' }}>75%</span>
            </div>
            <div className="progress"><div className="bar" style={{ width: '75%' }} /></div>
            <div style={{ height: 6 }} />
            {([
              { n: 'XYZ0001501', s: 'done', msg: 'Enhanced · upscaled · masked' },
              { n: 'XYZ0001502', s: 'done', msg: 'Enhanced · upscaled · masked' },
              { n: 'XYZ0001503', s: 'proc', msg: 'Upscaling · 2× · ETA 1.2s' },
              { n: 'XYZ0001504', s: 'warn', msg: 'Soft mask edge · review' },
            ]).map(r => (
              <div key={r.n} className="status-item">
                <span className="ico">
                  {r.s === 'done' && <CheckIcon size={12} strokeWidth={2.4} style={{ color: 'var(--ok)' }} />}
                  {r.s === 'proc' && <div className="spin" />}
                  {r.s === 'warn' && <AlertTriangle size={12} style={{ color: 'var(--warn)' }} />}
                </span>
                <span className="mono" style={{ color: 'var(--ink-2)', width: 54 }}>{r.n.slice(-4)}</span>
                <span style={{
                  color: r.s === 'warn' ? 'var(--warn)' : 'var(--ink-3)',
                  fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {r.msg}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
