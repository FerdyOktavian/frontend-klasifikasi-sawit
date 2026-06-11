import { useRef, useState } from "react";
import "./App.css";

const API_URL = "https://ferrdy-klasifikasi-sawit.hf.space/predict";
const MAX_ZOOM = 5;

function App() {
  const topRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("home");
  const [mode, setMode] = useState("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [history, setHistory] = useState(() => {
    try {
      const savedHistory = localStorage.getItem("sawitPredictionHistory");
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
      console.error("Gagal membaca history:", error);
      localStorage.removeItem("sawitPredictionHistory");
      return [];
    }
  });

  const getClassInfo = (className) => {
    const info = {
      belum_masak: {
        title: "Belum Masak",
        status: "Belum disarankan panen",
        color: "green",
        description:
          "Buah masih berada pada tahap awal kematangan. Sebaiknya lakukan pemantauan ulang sebelum dipanen.",
        reason:
          "Biasanya ditandai warna buah yang masih cenderung gelap, belum banyak warna oranye/merah, dan ciri kematangan belum terlihat kuat.",
        action:
          "Ambil foto ulang beberapa hari kemudian atau tunggu sampai warna buah lebih matang.",
        fruitInfo: [
          "Warna buah masih dominan gelap",
          "Tingkat kematangan belum optimal",
          "Belum direkomendasikan untuk panen",
          "Potensi rendemen minyak belum maksimal",
        ],
        icon: "🟢",
      },
      masak: {
        title: "Masak",
        status: "Siap panen",
        color: "orange",
        description:
          "Buah berada pada tingkat kematangan yang baik dan lebih sesuai untuk proses panen.",
        reason:
          "Model membaca ciri visual buah yang sudah cukup matang, seperti perubahan warna yang lebih jelas dan pola kematangan yang lebih stabil.",
        action:
          "Buah dapat diprioritaskan untuk dipanen apabila kondisi lapangan juga mendukung.",
        fruitInfo: [
          "Tingkat kematangan optimal",
          "Direkomendasikan untuk panen",
          "Potensi kualitas minyak baik",
          "Risiko kehilangan hasil rendah",
        ],
        icon: "🟠",
      },
      terlalu_masak: {
        title: "Terlalu Masak",
        status: "Melewati kematangan optimal",
        color: "red",
        description:
          "Buah sudah melewati kondisi matang optimal. Perlu segera ditangani agar kualitas hasil tidak menurun.",
        reason:
          "Biasanya ditandai warna buah yang lebih tua/terang, tekstur lebih matang, atau adanya indikasi buah sudah melewati fase optimal.",
        action:
          "Segera lakukan penanganan agar kualitas hasil tidak semakin menurun.",
        fruitInfo: [
          "Buah melewati fase optimal",
          "Risiko kehilangan hasil meningkat",
          "Kualitas panen dapat menurun",
          "Perlu segera ditangani",
        ],
        icon: "🔴",
      },
    };

    return (
      info[className] || {
        title: className || "Tidak Diketahui",
        status: "Hasil terdeteksi",
        color: "green",
        description: "Sistem berhasil membaca hasil klasifikasi gambar.",
        reason: "Model memilih kelas dengan probabilitas tertinggi.",
        action: "Gunakan hasil ini sebagai bantuan awal.",
        fruitInfo: ["Hasil prediksi berhasil diproses oleh sistem."],
        icon: "📌",
      }
    );
  };

  const getConfidenceStatus = (confidence) => {
    if (confidence >= 90) return "Sangat yakin";
    if (confidence >= 75) return "Cukup yakin";
    return "Perlu dicek ulang";
  };

  const getHistoryStats = () => {
    const stats = {
      belum_masak: 0,
      masak: 0,
      terlalu_masak: 0,
    };

    history.forEach((item) => {
      if (stats[item.predicted_class] !== undefined) {
        stats[item.predicted_class] += 1;
      }
    });

    return stats;
  };

  const switchMode = (selectedMode) => {
    stopCamera();
    setMode(selectedMode);
    setCapturedImage(null);
    setResult(null);
    setZoom(1);
  };

  const startCamera = async () => {
    try {
      setCapturedImage(null);
      setResult(null);
      setZoom(1);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraActive(true);
    } catch (error) {
      console.error(error);
      alert("Kamera gagal dibuka. Pastikan izin kamera sudah diberikan.");
    }
  };

  const stopCamera = () => {
    const video = videoRef.current;

    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    setCameraActive(false);
  };

  const zoomIn = () => {
    setZoom((prev) => Math.min(Number((prev + 0.2).toFixed(1)), MAX_ZOOM));
  };

  const zoomOut = () => {
    setZoom((prev) => Math.max(Number((prev - 0.2).toFixed(1)), 1));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      alert("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const ctx = canvas.getContext("2d");

    const cropWidth = videoWidth / zoom;
    const cropHeight = videoHeight / zoom;
    const cropX = (videoWidth - cropWidth) / 2;
    const cropY = (videoHeight - cropHeight) / 2;

    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const imageData = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedImage(imageData);
    setResult(null);

    stopCamera();
  };

  const retakePhoto = async () => {
    setCapturedImage(null);
    setResult(null);
    setZoom(1);

    if (mode === "camera") {
      await startCamera();
    }
  };

  const handleGalleryImage = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setCapturedImage(reader.result);
      setResult(null);
      stopCamera();
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const dataURLtoFile = (dataUrl, filename) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const binary = atob(arr[1]);
    let length = binary.length;
    const u8arr = new Uint8Array(length);

    while (length--) {
      u8arr[length] = binary.charCodeAt(length);
    }

    return new File([u8arr], filename, { type: mime });
  };

  const saveToHistory = (predictionData, imageData) => {
    const classInfo = getClassInfo(predictionData.predicted_class);

    const newItem = {
      id: Date.now(),
      image: imageData,
      result: predictionData,
      predicted_class: predictionData.predicted_class,
      title: classInfo.title,
      confidence: predictionData.confidence,
      status: classInfo.status,
      source: mode === "camera" ? "Kamera" : "Galeri",
      time: new Date().toLocaleString("id-ID"),
    };

    const updatedHistory = [newItem, ...history].slice(0, 5);

    setHistory(updatedHistory);
    localStorage.setItem(
      "sawitPredictionHistory",
      JSON.stringify(updatedHistory),
    );
  };

  const openHistoryItem = (item) => {
    stopCamera();
    setActiveTab("home");
    setCapturedImage(item.image);
    setResult(item.result);
    setZoom(1);

    setTimeout(() => {
      topRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  };

  const deleteHistoryItem = (id) => {
    const updatedHistory = history.filter((item) => item.id !== id);

    setHistory(updatedHistory);
    localStorage.setItem(
      "sawitPredictionHistory",
      JSON.stringify(updatedHistory),
    );
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("sawitPredictionHistory");
  };

  const predictCapturedImage = async () => {
    if (!capturedImage) {
      alert("Ambil atau pilih gambar dulu ya.");
      return;
    }

    setLoading(true);
    setResult(null);

    const file = dataURLtoFile(capturedImage, "sawit-image.jpg");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Backend error");
      }

      const data = await response.json();
      setResult(data);
      saveToHistory(data, capturedImage);
    } catch (error) {
      console.error(error);
      alert("Gagal prediksi. Pastikan backend FastAPI masih aktif.");
    } finally {
      setLoading(false);
    }
  };

  const exportAsImage = () => {
    if (!result || !capturedImage) {
      alert("Belum ada hasil prediksi untuk diekspor.");
      return;
    }

    const classInfo = getClassInfo(result.predicted_class);
    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d");

    exportCanvas.width = 900;
    exportCanvas.height = 1450;

    const drawRoundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const wrapText = (text, x, y, maxWidth, lineHeight) => {
      const words = String(text || "").split(" ");
      let line = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line, x, y);
          line = words[i] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }

      ctx.fillText(line, x, y);
      return y + lineHeight;
    };

    ctx.fillStyle = "#fff7e8";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    ctx.fillStyle = "#24351f";
    ctx.font = "bold 42px Arial";
    ctx.fillText("Hasil Prediksi Sawit", 50, 70);

    ctx.fillStyle = "#6f604c";
    ctx.font = "24px Arial";
    ctx.fillText("Model: EfficientNetV2S", 50, 112);
    ctx.fillText(`Tanggal: ${new Date().toLocaleString("id-ID")}`, 50, 150);
    ctx.fillText(`Sumber: ${mode === "camera" ? "Kamera" : "Galeri"}`, 50, 188);

    const img = new Image();

    img.onload = () => {
      const imageX = 50;
      const imageY = 230;
      const imageW = 800;
      const imageH = 520;

      ctx.save();
      drawRoundRect(imageX, imageY, imageW, imageH, 28);
      ctx.clip();
      ctx.drawImage(img, imageX, imageY, imageW, imageH);
      ctx.restore();

      const cardX = 50;
      const cardY = 800;
      const cardW = 800;
      const cardH = 540;

      ctx.fillStyle = "#ffffff";
      drawRoundRect(cardX, cardY, cardW, cardH, 28);
      ctx.fill();

      let y = cardY + 65;

      ctx.fillStyle = "#24351f";
      ctx.font = "bold 36px Arial";
      ctx.fillText(`Prediksi: ${classInfo.title}`, cardX + 35, y);

      y += 55;
      ctx.fillStyle = "#2f7d32";
      ctx.font = "bold 32px Arial";
      ctx.fillText(`Confidence: ${result.confidence}%`, cardX + 35, y);

      y += 48;
      ctx.fillStyle = "#3d3428";
      ctx.font = "24px Arial";
      ctx.fillText(`Status: ${classInfo.status}`, cardX + 35, y);

      y += 50;
      ctx.fillStyle = "#6f604c";
      ctx.font = "22px Arial";
      y = wrapText(classInfo.description, cardX + 35, y, 720, 32);

      y += 28;
      ctx.fillStyle = "#24351f";
      ctx.font = "bold 24px Arial";
      ctx.fillText("Probabilitas:", cardX + 35, y);

      y += 40;
      Object.entries(result.probabilities || {}).forEach(([label, value]) => {
        ctx.fillStyle = "#3d3428";
        ctx.font = "22px Arial";
        ctx.fillText(
          `${getClassInfo(label).title}: ${Number(value).toFixed(2)}%`,
          cardX + 35,
          y,
        );
        y += 36;
      });

      ctx.fillStyle = "#8a7a65";
      ctx.font = "18px Arial";
      wrapText(
        "Catatan: hasil prediksi digunakan sebagai bantuan awal dan tetap perlu disesuaikan dengan kondisi lapangan.",
        50,
        1400,
        800,
        24,
      );

      const link = document.createElement("a");
      link.download = `hasil-prediksi-sawit-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    };

    img.src = capturedImage;
  };

  const exportAsPDF = () => {
    if (!result || !capturedImage) {
      alert("Belum ada hasil prediksi untuk diekspor.");
      return;
    }

    const classInfo = getClassInfo(result.predicted_class);

    const probabilityRows = Object.entries(result.probabilities || {})
      .map(
        ([label, value]) => `
          <tr>
            <td>${getClassInfo(label).title}</td>
            <td>${Number(value).toFixed(2)}%</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Popup diblokir. Izinkan popup untuk menyimpan PDF.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Hasil Prediksi Sawit</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #fff7e8;
              padding: 24px;
              color: #24351f;
            }
            .card {
              max-width: 720px;
              margin: auto;
              background: #ffffff;
              border-radius: 20px;
              padding: 24px;
              border: 1px solid #ead8bd;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 28px;
            }
            .meta {
              color: #6f604c;
              margin-bottom: 18px;
            }
            img {
              width: 100%;
              max-height: 420px;
              object-fit: cover;
              border-radius: 16px;
              margin-bottom: 18px;
            }
            .result {
              background: #f4ead8;
              border-radius: 16px;
              padding: 16px;
              margin-bottom: 16px;
            }
            .prediction {
              font-size: 26px;
              font-weight: bold;
              margin: 0;
            }
            .confidence {
              color: #2f7d32;
              font-size: 22px;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th, td {
              border: 1px solid #ead8bd;
              padding: 10px;
              text-align: left;
            }
            th {
              background: #f4ead8;
            }
            p {
              line-height: 1.5;
            }
            @media print {
              body {
                background: #ffffff;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Hasil Prediksi Sawit</h1>
            <div class="meta">
              Model: EfficientNetV2S<br/>
              Tanggal: ${new Date().toLocaleString("id-ID")}<br/>
              Sumber: ${mode === "camera" ? "Kamera" : "Galeri"}
            </div>

            <img src="${capturedImage}" />

            <div class="result">
              <p class="prediction">${classInfo.icon} ${classInfo.title}</p>
              <p>Status: <b>${classInfo.status}</b></p>
              <p class="confidence">Confidence: ${result.confidence}%</p>
            </div>

            <h3>Rekomendasi</h3>
            <p>${classInfo.description}</p>

            <h3>Kenapa hasil ini muncul?</h3>
            <p>${classInfo.reason}</p>

            <h3>Saran tindakan</h3>
            <p>${classInfo.action}</p>

            <h3>Probabilitas</h3>
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Probabilitas</th>
                </tr>
              </thead>
              <tbody>
                ${probabilityRows}
              </tbody>
            </table>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const classInfo = result ? getClassInfo(result.predicted_class) : null;
  const stats = getHistoryStats();
  const confidence = result ? Number(result.confidence) : 0;

  return (
    <div className="app">
      <main className="phone-shell" ref={topRef}>
        {activeTab === "home" && (
          <>
            <section className="header">
              <p className="eyebrow">EfficientNetV2S</p>
              <h1>Klasifikasi Sawit</h1>
              <p className="subtitle">
                Gunakan kamera atau galeri untuk prediksi kematangan buah sawit.
              </p>
            </section>

            <section className="mode-switch">
              <button
                className={mode === "camera" ? "mode-btn active" : "mode-btn"}
                onClick={() => switchMode("camera")}
              >
                Kamera
              </button>

              <button
                className={mode === "gallery" ? "mode-btn active" : "mode-btn"}
                onClick={() => switchMode("gallery")}
              >
                Galeri
              </button>
            </section>

            <section className="tips-card">
              <div className="tips-icon">💡</div>
              <div>
                <b>Tips foto terbaik</b>
                <p>
                  Pastikan buah terlihat jelas, cahaya cukup, dan objek berada
                  di tengah kotak panduan.
                </p>
              </div>
            </section>

            <section className="camera-card">
              <div className="camera-frame">
                {!capturedImage ? (
                  mode === "camera" ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-media"
                      style={{ transform: `scale(${zoom})` }}
                    />
                  ) : (
                    <div className="gallery-placeholder">
                      <span>🖼️</span>
                      <p>Belum ada foto dipilih</p>
                    </div>
                  )
                ) : (
                  <img
                    src={capturedImage}
                    alt="Hasil input"
                    className="camera-media"
                  />
                )}

                {mode === "camera" && !cameraActive && !capturedImage && (
                  <div className="camera-placeholder">
                    <span>📷</span>
                    <p>Kamera belum aktif</p>
                  </div>
                )}

                {mode === "camera" && !capturedImage && (
                  <>
                    <div className="camera-guide"></div>
                    <div className="zoom-badge">{zoom.toFixed(1)}x</div>
                  </>
                )}
              </div>

              {mode === "camera" && !capturedImage && (
                <div className="zoom-panel">
                  <button
                    onClick={zoomOut}
                    disabled={!cameraActive || zoom <= 1}
                  >
                    −
                  </button>

                  <div className="zoom-info">
                    <span>Zoom</span>
                    <b>{zoom.toFixed(1)}x</b>
                  </div>

                  <button
                    onClick={zoomIn}
                    disabled={!cameraActive || zoom >= MAX_ZOOM}
                  >
                    +
                  </button>

                  <button
                    className="reset-zoom"
                    onClick={resetZoom}
                    disabled={!cameraActive || zoom === 1}
                  >
                    Reset
                  </button>
                </div>
              )}

              {mode === "camera" ? (
                <div className="button-grid">
                  {capturedImage ? (
                    <button className="secondary-btn" onClick={retakePhoto}>
                      Foto Ulang
                    </button>
                  ) : !cameraActive ? (
                    <button className="secondary-btn" onClick={startCamera}>
                      Buka Kamera
                    </button>
                  ) : (
                    <button className="danger-btn" onClick={stopCamera}>
                      Tutup Kamera
                    </button>
                  )}

                  {!capturedImage ? (
                    <button
                      className="primary-btn"
                      onClick={captureImage}
                      disabled={!cameraActive}
                    >
                      Ambil Gambar
                    </button>
                  ) : (
                    <button
                      className="primary-btn"
                      onClick={predictCapturedImage}
                      disabled={loading}
                    >
                      {loading ? "Menganalisis..." : "Prediksi"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="button-grid">
                  <button className="secondary-btn" onClick={openGallery}>
                    Pilih Galeri
                  </button>

                  <button className="primary-btn" onClick={openGallery}>
                    {capturedImage ? "Ganti Foto" : "Upload Foto"}
                  </button>
                </div>
              )}

              {mode === "gallery" && capturedImage && (
                <button
                  className="primary-btn full"
                  onClick={predictCapturedImage}
                  disabled={loading}
                >
                  {loading ? "Menganalisis..." : "Prediksi Sekarang"}
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleGalleryImage}
                style={{ display: "none" }}
              />
            </section>

            {loading && (
              <section className="loading-card">
                <div className="spinner"></div>
                <h2>Menganalisis Citra</h2>
                <p>Model EfficientNetV2S sedang memproses gambar sawit.</p>
              </section>
            )}

            {result && classInfo && (
              <section className={`result-card result-${classInfo.color}`}>
                <div className="result-top">
                  <div className="result-icon">{classInfo.icon}</div>
                  <div>
                    <p className="result-label">Hasil Prediksi</p>
                    <h2>{classInfo.title}</h2>
                  </div>
                </div>

                <div className="status-pill">{classInfo.status}</div>

                <div className="confidence-box">
                  <span>Confidence</span>
                  <b>{result.confidence}%</b>
                  <small>{getConfidenceStatus(confidence)}</small>
                </div>

                <div className="scan-meta">
                  <span>📅 {new Date().toLocaleDateString("id-ID")}</span>
                  <span>📷 {mode === "camera" ? "Kamera" : "Galeri"}</span>
                </div>

                {confidence < 75 && (
                  <div className="warning-box">
                    <b>⚠️ Hasil perlu dicek ulang</b>
                    <p>
                      Confidence masih rendah. Coba foto ulang dengan cahaya
                      lebih terang, jarak lebih dekat, dan objek lebih jelas.
                    </p>
                  </div>
                )}

                <div className="recommendation-box">
                  <b>Rekomendasi</b>
                  <p>{classInfo.description}</p>
                </div>

                <div className="recommendation-box">
                  <b>Kenapa hasil ini muncul?</b>
                  <p>{classInfo.reason}</p>
                </div>

                <div className="recommendation-box">
                  <b>Saran tindakan</b>
                  <p>{classInfo.action}</p>
                </div>

                <div className="fruit-info-box">
                  <b>Informasi Buah Sawit</b>
                  <ul>
                    {(classInfo.fruitInfo || []).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="prob-list">
                  {Object.entries(result.probabilities || {}).map(
                    ([label, value]) => {
                      const percent = Number(value);

                      return (
                        <div className="prob-bar-item" key={label}>
                          <div className="prob-bar-top">
                            <span>{getClassInfo(label).title}</span>
                            <b>{percent.toFixed(2)}%</b>
                          </div>

                          <div className="prob-track">
                            <div
                              className="prob-fill"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>

                <div className="export-grid">
                  <button className="secondary-btn" onClick={exportAsImage}>
                    Simpan Gambar
                  </button>
                  <button className="secondary-btn" onClick={exportAsPDF}>
                    Export PDF
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            <section className="header">
              <p className="eyebrow">Riwayat Prediksi</p>
              <h1>History</h1>
              <p className="subtitle">
                Lihat kembali hasil prediksi terakhir yang pernah dilakukan.
              </p>
            </section>

            {history.length > 0 ? (
              <section className="history-card">
                <div className="history-header">
                  <div>
                    <p className="result-label">Ringkasan</p>
                    <h2>Prediksi Terakhir</h2>
                  </div>

                  <button className="clear-history-btn" onClick={clearHistory}>
                    Hapus Semua
                  </button>
                </div>

                <div className="stats-grid">
                  <div>
                    <span>Belum</span>
                    <b>{stats.belum_masak}</b>
                  </div>
                  <div>
                    <span>Masak</span>
                    <b>{stats.masak}</b>
                  </div>
                  <div>
                    <span>Terlalu</span>
                    <b>{stats.terlalu_masak}</b>
                  </div>
                </div>

                <div className="history-list">
                  {history.map((item) => (
                    <div className="history-item" key={item.id}>
                      <button
                        className="history-main"
                        onClick={() => openHistoryItem(item)}
                      >
                        <img src={item.image} alt={item.title} />

                        <div className="history-info">
                          <b>{item.title}</b>
                          <span>{item.status}</span>
                          <small>
                            {item.time} • {item.source || "Input"}
                          </small>
                        </div>

                        <div className="history-confidence">
                          {Number(item.confidence).toFixed(1)}%
                        </div>
                      </button>

                      <button
                        className="delete-history-item"
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="empty-card">
                <div className="empty-icon">📊</div>
                <h2>Belum Ada Riwayat</h2>
                <p>
                  Hasil prediksi akan muncul di sini setelah kamu melakukan
                  prediksi gambar.
                </p>
                <button
                  className="primary-btn full"
                  onClick={() => setActiveTab("home")}
                >
                  Mulai Prediksi
                </button>
              </section>
            )}
          </>
        )}

        {activeTab === "about" && (
          <>
            <section className="about-premium-hero">
              <div className="about-glow"></div>

              <div className="about-logo-premium">
                <span>🌴</span>
              </div>

              <p className="eyebrow light">Tentang Aplikasi</p>
              <h1>SawitVision AI</h1>
              <p>
                Aplikasi klasifikasi tingkat kematangan buah kelapa sawit
                berbasis citra digital dan Deep Learning.
              </p>

              <div className="version-pill">Versi 1.0.0</div>
            </section>

            <section className="about-card premium-card">
              <div className="section-title-row">
                <div>
                  <p className="result-label">Profil Sistem</p>
                  <h2>Informasi Aplikasi</h2>
                </div>
                <span className="mini-badge">AI</span>
              </div>

              <div className="premium-info-grid">
                <div>
                  <span>Model AI</span>
                  <b>EfficientNetV2S</b>
                </div>

                <div>
                  <span>Metode</span>
                  <b>Deep Learning</b>
                </div>

                <div>
                  <span>Jenis Tugas</span>
                  <b>Klasifikasi Citra</b>
                </div>

                <div>
                  <span>Input</span>
                  <b>Kamera & Galeri</b>
                </div>

                <div>
                  <span>Kelas</span>
                  <b>Belum Masak, Masak, Terlalu Masak</b>
                </div>

                <div>
                  <span>Output</span>
                  <b>Label, Confidence, Probabilitas, Rekomendasi</b>
                </div>
              </div>
            </section>

            <section className="about-card developer-premium-card">
              <div className="developer-cover"></div>

              <div className="developer-profile">
                <div className="developer-avatar-premium">MF</div>

                <div>
                  <p className="result-label">Developer</p>
                  <h2>Muhammad Ferdy Oktavian</h2>
                  <p>
                    Pengembang aplikasi klasifikasi kematangan buah kelapa sawit
                    menggunakan model EfficientNetV2S dan teknologi web modern.
                  </p>
                </div>
              </div>

              <div className="developer-tags">
                <span>React</span>
                <span>FastAPI</span>
                <span>TensorFlow</span>
                <span>Computer Vision</span>
              </div>
            </section>

            <section className="about-card premium-card">
              <div className="section-title-row">
                <div>
                  <p className="result-label">Tujuan</p>
                  <h2>Manfaat Aplikasi</h2>
                </div>
                <span className="mini-badge">🌾</span>
              </div>

              <div className="benefit-list">
                <div>
                  <span>01</span>
                  <p>
                    Membantu proses identifikasi tingkat kematangan buah sawit.
                  </p>
                </div>

                <div>
                  <span>02</span>
                  <p>
                    Memberikan hasil prediksi berupa label dan tingkat
                    confidence.
                  </p>
                </div>

                <div>
                  <span>03</span>
                  <p>
                    Menyediakan rekomendasi awal berdasarkan hasil klasifikasi.
                  </p>
                </div>
              </div>
            </section>

            <section className="about-note-card">
              <b>Catatan Penggunaan</b>
              <p>
                Hasil prediksi digunakan sebagai alat bantu awal. Keputusan
                lapangan tetap perlu mempertimbangkan kondisi buah secara
                langsung, pencahayaan, jarak pengambilan gambar, dan pengalaman
                pengguna di lapangan.
              </p>
            </section>
          </>
        )}

        <nav className="bottom-nav">
          <button
            className={activeTab === "home" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("home")}
          >
            🏠
            <span>Home</span>
          </button>

          <button
            className={activeTab === "history" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("history")}
          >
            📊
            <span>History</span>
          </button>

          <button
            className={activeTab === "about" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveTab("about")}
          >
            ℹ️
            <span>About</span>
          </button>
        </nav>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </main>
    </div>
  );
}

export default App;
