# Lê os QR codes de uma página com várias tentativas (recortes e ampliações)
import sys, cv2
det = cv2.QRCodeDetector()
def try_img(im):
    out = set()
    try:
        ok, texts, _, _ = det.detectAndDecodeMulti(im)
        if ok: out |= {t for t in texts if t}
    except Exception: pass
    t, _, _ = det.detectAndDecode(im)
    if t: out.add(t)
    return out
for f in sys.argv[1:]:
    im = cv2.imread(f); H, W = im.shape[:2]; found = set()
    for scale in (1.0, 1.5, 2.0):
        big = cv2.resize(im, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC) if scale != 1 else im
        found |= try_img(big)
        h, w = big.shape[:2]
        for gy in range(3):
            for gx in range(3):
                y0, x0 = int(gy * h / 4), int(gx * w / 4)
                found |= try_img(big[y0:y0 + h // 2, x0:x0 + w // 2])
        if found: break
    print(f.split('/')[-1], '|', ' ; '.join(sorted(found)) or '(nenhum)')
