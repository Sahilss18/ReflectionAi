import React, { useEffect, useRef } from 'react';

const AsciiBackground = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    // Config based on the 21st.dev spec
    const config = {
      cellSize: 10,
      tint: '#3ca6ff',
      charSet: 'Ñ@#W$9876543210?!abc;:+=-,._ ',
      chromaticIntensity: 2, // simplified from config 20
    };
    
    let animationFrameId;
    let width, height;
    
    let offscreenCanvas = document.createElement('canvas');
    let offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    let imageData = null;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      
      drawOffscreen();
    };
    
    const drawOffscreen = () => {
      // Create a beautiful programmatic gradient/noise pattern
      const grad = offscreenCtx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#444444');
      grad.addColorStop(1, '#000000');
      
      offscreenCtx.fillStyle = grad;
      offscreenCtx.fillRect(0, 0, width, height);
      
      // Add some circles for structure
      offscreenCtx.fillStyle = '#ffffff';
      offscreenCtx.beginPath();
      offscreenCtx.arc(width * 0.2, height * 0.3, width * 0.2, 0, Math.PI * 2);
      offscreenCtx.fill();
      
      offscreenCtx.fillStyle = '#888888';
      offscreenCtx.beginPath();
      offscreenCtx.arc(width * 0.8, height * 0.7, width * 0.3, 0, Math.PI * 2);
      offscreenCtx.fill();

      imageData = offscreenCtx.getImageData(0, 0, width, height).data;
    };

    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('resize', resize);
    resize();

    // Render Loop
    const render = (time) => {
      if (!imageData) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      
      // Clear background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      
      // Calculate shimmer time offsets
      const shimmerOffset = time * 0.001; // animSpeed
      
      ctx.font = `bold ${config.cellSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Loop through grid cells
      for (let y = 0; y < height; y += config.cellSize) {
        for (let x = 0; x < width; x += config.cellSize) {
          
          const index = ((y * width) + x) * 4;
          const r = imageData[index];
          const g = imageData[index + 1];
          const b = imageData[index + 2];
          
          // Calculate luminance
          let luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          
          // Apply contrast/brightness (simplified)
          luminance = Math.max(0, Math.min(1, (luminance - 0.5) * 1.2 + 0.5));
          
          // Apply shimmer animation
          const shimmer = Math.sin(x * 0.01 + y * 0.01 + shimmerOffset) * 0.2;
          let animatedLum = Math.max(0, Math.min(1, luminance + shimmer));
          
          // Select Character based on animated luminance
          const charIndex = Math.floor(animatedLum * (config.charSet.length - 1));
          const char = config.charSet[charIndex];
          
          // Draw logic
          if (animatedLum > 0.05) {
            // Apply overlay tint manually
            ctx.fillStyle = config.tint;
            ctx.globalAlpha = animatedLum * 0.8 + 0.2; // Opacity varies with brightness
            ctx.fillText(char, x + config.cellSize/2, y + config.cellSize/2);
          }
        }
      }
      
      // Post-effect: Chromatic Aberration (Simplified pass)
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.fillRect(-config.chromaticIntensity, 0, width, height);
      ctx.fillStyle = 'rgba(0, 0, 255, 0.1)';
      ctx.fillRect(config.chromaticIntensity, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;

      // Post-effect: Vignette (darken edges)
      const gradient = ctx.createRadialGradient(width/2, height/2, height * 0.3, width/2, height/2, height * 0.8);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };
    
    render(0);
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
};

export default AsciiBackground;
