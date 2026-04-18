import { useState, useEffect } from 'react';
const mqtt = window.mqtt;
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, Droplets, Cpu, Wifi, WifiOff } from 'lucide-react';
import './index.css';

// Konfigurasi MQTT 
const MQTT_URL = 'ws://195.35.23.135:15675/ws'; 
const MQTT_TOPIC = 'r_abyan';
const MQTT_OPTIONS = {
  username: '/vh-iot-cps-2026:iot-cps-2026',
  password: 'iotcihuy71.',
  clientId: 'react_dashboard_' + Math.random().toString(16).substring(2, 8),
  keepalive: 60,
  clean: true,
  reconnectPeriod: 5000, // Coba reconnect tiap 5 detik jika putus
};

// Komponen Card
const Card = ({ title, value, unit, icon: Icon, iconClass, footerText }) => (
  <div className="glass-card">
    <div className="card-header">
      <h3 className="card-title">{title}</h3>
      <div className={`card-icon ${iconClass}`}>
        <Icon size={20} />
      </div>
    </div>
    <div className="card-value-container">
      <h2 className="card-value">{value}</h2>
      <span className="card-unit">{unit}</span>
    </div>
    <div className="card-footer">
      <span>{footerText}</span>
    </div>
  </div>
);

// Tooltip Kustom untuk Grafik
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <div className="tooltip-time">{label}</div>
        <div className="tooltip-item" style={{ color: '#ef4444' }}>
          <Thermometer size={14} /> Suhu: {payload[0].value} °C
        </div>
        <div className="tooltip-item" style={{ color: '#3b82f6' }}>
          <Droplets size={14} /> Kelembapan: {payload[1].value} %
        </div>
      </div>
    );
  }
  return null;
};

function App() {
  const [connectStatus, setConnectStatus] = useState('connecting'); // connecting, connected, error, disconnected
  const [currentData, setCurrentData] = useState({
    suhu: 0,
    kelembaban: 0,
    mac: 'Tidak diketahui'
  });
  
  // State untuk menyimpan maksimal 20 data historis sementara di memory (untuk grafik)
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    console.log('Mencoba menyambungkan ke Broker MQTT (WebSockets)...', MQTT_URL);
    const mqttClient = mqtt.connect(MQTT_URL, MQTT_OPTIONS);

    mqttClient.on('connect', () => {
      console.log('Terhubung ke MQTT Broker');
      setConnectStatus('connected');
      
      // Subscribe ke topik
      mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) console.log(`Berhasil subscribe ke topik: ${MQTT_TOPIC}`);
      });
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Error:', err);
      setConnectStatus('error');
    });

    mqttClient.on('reconnect', () => {
      setConnectStatus('connecting');
    });

    mqttClient.on('offline', () => {
      setConnectStatus('disconnected');
    });

    mqttClient.on('message', (topic, message) => {
      try {
        const payloadStr = message.toString();
        console.log(`Pesan masuk dari ${topic}:`, payloadStr);
        const parsed = JSON.parse(payloadStr);

        // Update Indikator Saat Ini
        setCurrentData(parsed);

        // Tambahkan ke grafik (maksimal simpan 15 titik terakhir)
        setHistoryData((prev) => {
          const now = new Date();
          const timeLabel = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
          
          const newDataPoint = {
            time: timeLabel,
            suhu: parsed.suhu,
            kelembaban: parsed.kelembaban
          };

          const newHistory = [...prev, newDataPoint];
          if (newHistory.length > 15) {
            return newHistory.slice(newHistory.length - 15);
          }
          return newHistory;
        });

      } catch (e) {
        console.error('Gagal mem-parsing payload JSON:', e);
      }
    });

    // Cleanup saat komponen dibongkar
    return () => {
      if (mqttClient) {
        mqttClient.end();
      }
    };
  }, []);

  // UI Helper
  const getStatusDisplay = () => {
    switch (connectStatus) {
      case 'connected': return { text: 'Terhubung ke Broker', class: 'status-connected', Icon: Wifi };
      case 'connecting': return { text: 'Menyambungkan...', class: 'status-connecting', Icon: Wifi };
      case 'error': return { text: 'Gagal Terhubung / Akses Ditolak', class: 'status-error', Icon: WifiOff };
      case 'disconnected': return { text: 'Terputus', class: 'status-disconnected', Icon: WifiOff };
      default: return { text: 'Unknown', class: 'status-disconnected', Icon: WifiOff };
    }
  };

  const statusRef = getStatusDisplay();
  const StatusIcon = statusRef.Icon;
  const isLedOn = currentData.kelembaban > 50;

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">KELOMPOKK TIGAAA</h1>
          <p className="dashboard-subtitle">Sensor DHT11</p>
        </div>
        <div className="connection-status">
          <div className={`status-dot ${statusRef.class} pulse-anim`}></div>
          <StatusIcon size={16} />
          {statusRef.text}
        </div>
      </header>

      <div className="cards-grid">
        <Card 
          title="Suhu Ruangan" 
          value={currentData.suhu} 
          unit="°C" 
          icon={Thermometer} 
          iconClass="icon-temp"
          footerText={`Terakhir update: Beberapa detik lalu`}
        />
        <Card 
          title="Kelembapan" 
          value={currentData.kelembaban} 
          unit="%" 
          icon={Droplets} 
          iconClass="icon-hum"
          footerText={`Status LED: ${isLedOn ? 'NYALA' : 'MATI'} (Batasan: 50%)`}
        />
        <Card 
          title="Identitas Perangkat" 
          value={currentData.mac === 'Tidak diketahui' ? '---' : currentData.mac.substring(12)} // Singkat MAC untuk display
          unit="" 
          icon={Cpu} 
          iconClass="icon-device"
          footerText={`MAC: ${currentData.mac}`}
        />
      </div>

      <div className="chart-container">
        <div className="chart-header">
          <h3 className="card-title">Grafik Pergerakan Sensor</h3>
        </div>
        {historyData.length === 0 ? (
          <div style={{ display: 'flex', height: '80%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Menunggu data pertama masuk...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={historyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-secondary)" tick={{fontSize: 12}} />
              <YAxis stroke="var(--text-secondary)" tick={{fontSize: 12}} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="suhu" 
                stroke="#ef4444" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2 }} 
                activeDot={{ r: 6 }} 
                animationDuration={500}
              />
              <Line 
                type="monotone" 
                dataKey="kelembaban" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2 }} 
                activeDot={{ r: 6 }} 
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default App;
