# 영상의 화면 변화와 소리의 타격이 박자에 맞는지 재요.
#   python3 tools/tvc/sync_check.py <영상.mp4> <bpm> <박1,박2,...>
# 1) 소리: 스펙트럼 변화량(onset)의 정점 시각 → 계획한 박과의 차이(ms)
# 2) 화면: 프레임 사이 변화량의 급등 시각 → 계획한 박과의 차이(ms, 30fps라 한 프레임 = 33ms)
# 3) 전체: 화면 변화 곡선과 소리 타격 곡선을 서로 밀어 보며 가장 잘 겹치는 어긋남(ms)
import subprocess, sys
import numpy as np

src, bpm, beats = sys.argv[1], float(sys.argv[2]), [float(x) for x in sys.argv[3].split(',')]
B = 60 / bpm
SR, FPS = 22050, 30
a = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
hop = 256
win = np.hanning(1024)
frames = np.lib.stride_tricks.sliding_window_view(np.pad(a, (512, 512)), 1024)[::hop] * win
mag = np.abs(np.fft.rfft(frames, axis=1))
flux = np.maximum(0, np.diff(np.log1p(mag * 10), axis=0)).sum(1)
flux = np.concatenate([[0], flux]); ta = np.arange(len(flux)) * hop / SR
w, h = 108, 192
v = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout, np.uint8)
v = v.reshape(-1, h, w).astype(np.float32)
diff = np.concatenate([[0], np.abs(np.diff(v, axis=0)).mean((1, 2))]); tv = np.arange(len(diff)) / FPS


def near_peak(t0, ts, sig, lo=-0.12, hi=0.12):
    m = (ts >= t0 + lo) & (ts <= t0 + hi)
    if not m.any():
        return None
    i = np.argmax(sig[m])
    return ts[m][i] - t0


print(f'{"박":>5} {"시각":>6} {"소리(ms)":>9} {"화면(ms)":>9}')
ea, ev = [], []
for b in beats:
    t0 = b * B
    da, dv = near_peak(t0, ta, flux, -0.05, 0.05), near_peak(t0, tv, diff, -0.07, 0.1)
    ea.append(abs(da) * 1000); ev.append(abs(dv) * 1000)
    print(f'{b:5.2f} {t0:6.2f} {da * 1000:9.0f} {dv * 1000:9.0f}')
# 전체 어긋남: 둘 다 30fps 격자로 맞춘 뒤 상관
fa = np.interp(tv, ta, flux)
fa, dv_ = (fa - fa.mean()) / fa.std(), (diff - diff.mean()) / diff.std()
lags = range(-6, 7)
cc = [np.dot(fa[max(0, -l):len(fa) - max(0, l)], dv_[max(0, l):len(dv_) - max(0, -l)]) for l in lags]
best = list(lags)[int(np.argmax(cc))]
print(f'평균 어긋남 소리 {np.mean(ea):.0f}ms · 화면 {np.mean(ev):.0f}ms(한 프레임 33ms) · 전체 곡선 최적 어긋남 {best * 1000 / FPS:.0f}ms')
