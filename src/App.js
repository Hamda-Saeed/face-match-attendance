import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const DynamicBackground = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particlesRef.current = [];
      const particleCount = Math.min(
        Math.floor((canvas.width * canvas.height) / 10000),
        100
      );

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 3 + 1,
          speedX: (Math.random() - 0.5) * 0.5,
          speedY: (Math.random() - 0.5) * 0.5,
          color: `rgba(180, 180, 255, ${Math.random() * 0.2 + 0.05})`
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(particle => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.strokeStyle = `rgba(150, 150, 255, ${0.2 - distance / 750})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    animate();

    const handleResize = () => {
      cancelAnimationFrame(animationFrameId.current);
      resizeCanvas();
      animate();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'
      }}
    />
  );
};

function App() {
  const [studentName, setStudentName] = useState('');
  const [labeledDescriptors, setLabeledDescriptors] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [presentStudents, setPresentStudents] = useState([]);
  const [absentStudents, setAbsentStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('register');
  const canvasRef = useRef();

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load models:", error);
        setLoading(false);
      }
    };
    loadModels();
  }, []);

  const handleStudentImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !studentName.trim()) return;

    try {
      const img = await faceapi.bufferToImage(file);
      const detections = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) return alert('No face detected in the image');

      const newDescriptor = new faceapi.LabeledFaceDescriptors(studentName, [detections.descriptor]);
      setLabeledDescriptors(prev => [...prev, newDescriptor]);
      setAllStudents(prev => [...new Set([...prev, studentName])]);
      setStudentName('');
      alert(`${studentName} registered successfully!`);
    } catch (error) {
      console.error("Registration error:", error);
      alert('Failed to register student. Please try again.');
    }
  };

  useEffect(() => {
    if (labeledDescriptors.length > 0) {
      setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.6));
    }
  }, [labeledDescriptors]);

  const handleGroupRecognition = async (e) => {
    const file = e.target.files[0];
    if (!file || !faceMatcher) return;

    try {
      const img = await faceapi.bufferToImage(file);
      
      const MAX_WIDTH = 1200;
      if (img.width > MAX_WIDTH) {
        const scale = MAX_WIDTH / img.width;
        img.width = MAX_WIDTH;
        img.height = img.height * scale;
      }

      const detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.display = 'inline-block';
      
      img.style.maxWidth = '100%';
      img.style.borderRadius = '12px';
      img.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
      container.appendChild(img);
      
      const canvas = faceapi.createCanvasFromMedia(img);
      faceapi.matchDimensions(canvas, { width: img.width, height: img.height });
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      container.appendChild(canvas);

      canvasRef.current.innerHTML = '';
      canvasRef.current.appendChild(container);

      const resizedDetections = faceapi.resizeResults(detections, { width: img.width, height: img.height });
      const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
      const present = [...new Set(results.map(r => r.label.split(' (')[0]))];
      const absent = allStudents.filter(name => !present.includes(name));

      results.forEach((result, i) => {
        const box = resizedDetections[i].detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, {
          label: result.toString(),
          boxColor: '#7b2cbf',
          lineWidth: 2,
          labelSize: 28
        });
        drawBox.draw(canvas);
      });

      setPresentStudents(present);
      setAbsentStudents(absent);
      setActiveTab('attendance');
    } catch (error) {
      console.error("Recognition error:", error);
      alert('Failed to process image. Please try another photo.');
    }
  };

  const removeStudent = (name) => {
    if (window.confirm(`Remove ${name} from the system?`)) {
      setLabeledDescriptors(prev => prev.filter(desc => desc.label !== name));
      setAllStudents(prev => prev.filter(n => n !== name));
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)',
        zIndex: 1000,
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#7b2cbf',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p>Loading face recognition engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', color: '#ffffff' }}>
      <DynamicBackground />
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        position: 'relative',
        zIndex: 1
      }}>
        <header style={{
          textAlign: 'center',
          marginBottom: '2.5rem',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '2.5rem',
            fontWeight: 700,
            background: 'linear-gradient(90deg, #ffffff, #c9d6ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>Face Attendance System</h1>
          <p style={{ margin: 0, fontSize: '1rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Automated classroom attendance with facial recognition
          </p>
        </header>

        <nav style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {['register', 'students', 'attendance'].map(tab => (
            <button
              key={tab}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === tab 
                  ? 'linear-gradient(135deg, rgba(123, 44, 191, 0.8), rgba(155, 81, 224, 0.8))'
                  : 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(5px)',
                boxShadow: activeTab === tab 
                  ? '0 4px 20px rgba(123, 44, 191, 0.4)'
                  : '0 4px 15px rgba(0, 0, 0, 0.1)',
                minWidth: '160px',
                '&:hover': {
                  background: activeTab === tab 
                    ? 'linear-gradient(135deg, rgba(123, 44, 191, 0.9), rgba(155, 81, 224, 0.9))'
                    : 'rgba(255, 255, 255, 0.15)',
                  transform: 'translateY(-2px)'
                }
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'register' && '➕ Register'}
              {tab === 'students' && '📋 Students'}
              {tab === 'attendance' && '📸 Attendance'}
            </button>
          ))}
        </nav>

        {activeTab === 'register' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
              Register New Student
            </h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Student Name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '250px',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  '&:focus': {
                    borderColor: 'rgba(123, 44, 191, 0.8)',
                    boxShadow: '0 0 0 2px rgba(123, 44, 191, 0.3)'
                  }
                }}
              />
              <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleStudentImageUpload} 
                  style={{ display: 'none' }} 
                />
                <span style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.15)'
                  }
                }}>📷 Upload Portrait</span>
              </label>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              Upload a clear frontal photo of the student's face for registration
            </p>
          </div>
        )}

        {activeTab === 'students' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
              Registered Students ({allStudents.length})
            </h2>
            {allStudents.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {allStudents.map((name, index) => (
                  <li key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease'
                  }}>
                    <span style={{ fontSize: '1rem', fontWeight: 500 }}>{name}</span>
                    <button 
                      onClick={() => removeStudent(name)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'rgba(255, 99, 71, 0.2)',
                        color: '#ff6347',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          background: 'rgba(255, 99, 71, 0.3)'
                        }
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)' }}>No students registered yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attendance' && (
          <>
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
            }}>
              <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
                Take Attendance
              </h2>
              <label style={{ display: 'inline-block', cursor: 'pointer' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleGroupRecognition} 
                  style={{ display: 'none' }} 
                />
                <span style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.15)'
                  }
                }}>📷 Upload Class Photo</span>
              </label>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                Upload a photo of today's class to automatically mark attendance
              </p>
            </div>

            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <div ref={canvasRef}></div>
            </div>

            {(presentStudents.length > 0 || absentStudents.length > 0) && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(12px)',
                borderRadius: '16px',
                padding: '2rem',
                marginBottom: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
              }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
                  Attendance Results
                </h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ color: '#4ade80', marginTop: 0, marginBottom: '1rem' }}>
                      ✅ Present ({presentStudents.length})
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {presentStudents.map((name, i) => (
                        <li key={i} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ color: '#f87171', marginTop: 0, marginBottom: '1rem' }}>
                      ❌ Absent ({absentStudents.length})
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {absentStudents.map((name, i) => (
                        <li key={i} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;