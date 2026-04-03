import React, { useEffect, useRef } from 'react';

const ConstellationBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    // Adjust density based on screen size
    const calculateParticles = () => Math.floor((window.innerWidth * window.innerHeight) / 15000);
    const maxDistance = 150;

    // Mouse interaction
    let mouse = {
      x: null,
      y: null,
      radius: 150
    };

    const handleMouseMove = (event) => {
      mouse.x = event.x;
      mouse.y = event.y;
    };

    const handleMouseOut = () => {
      mouse.x = undefined;
      mouse.y = undefined;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Re-init particles on significant resize to keep density feeling right
      initParticles();
    };

    class Particle {
      constructor(x, y) {
        this.x = x ?? Math.random() * canvas.width;
        this.y = y ?? Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = (Math.random() - 0.5) * 0.6;
        this.radius = Math.random() * 1.5 + 0.5;
      }
      update() {
        // Handle collision/repel with mouse
        if (mouse.x != null && mouse.y != null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (mouse.radius - distance) / mouse.radius;
            const directionX = forceDirectionX * force * 5;
            const directionY = forceDirectionY * force * 5;
            
            this.x -= directionX;
            this.y -= directionY;
          }
        }

        this.x += this.vx;
        this.y += this.vy;
        
        // Wrap around edges smoothly
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 120, 0, 0.8)';
        ctx.fill();
        
        // Slight glowing aura
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(255, 120, 0, 0.5)';
      }
    }

    const initParticles = () => {
      particles = [];
      const numParticles = calculateParticles();
      for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
      }
    };

    // Initial setup
    window.addEventListener('resize', resize);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        // Draw line to mouse if close
        if (mouse.x != null && mouse.y != null) {
          const dxMouse = particles[i].x - mouse.x;
          const dyMouse = particles[i].y - mouse.y;
          const distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
          
          if (distanceMouse < maxDistance * 1.2) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 166, 0, ${(1 - distanceMouse / (maxDistance * 1.2)) * 0.8})`;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }

        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < maxDistance) {
            ctx.beginPath();
            // Opacity fades out as distance approaches maxDistance
            ctx.strokeStyle = `rgba(255, 100, 0, ${(1 - distance / maxDistance) * 0.6})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none mix-blend-screen opacity-50 z-0"
    />
  );
};

export default ConstellationBackground;
