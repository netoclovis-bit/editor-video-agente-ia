import sys, glob, cv2
det = cv2.QRCodeDetector()
for f in sorted(glob.glob(sys.argv[1])):
    im = cv2.imread(f)
    try:
        ok, texts, pts, _ = det.detectAndDecodeMulti(im)
    except Exception as e:
        ok, texts = False, []
    if not ok or not any(texts):
        t, p, _ = det.detectAndDecode(im); texts = [t] if t else []
    print(f.split('/')[-1], '|', ' ; '.join(t for t in texts if t) or '(nenhum QR lido)')
