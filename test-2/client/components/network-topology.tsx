"use client"
import { useEffect, useRef } from 'react';

interface Peer {
  id: number;
  peerId: string;
  isConnected: boolean;
  lastSeen: string;
  location?: string;
  contribution: number;
}

interface NetworkTopologyProps {
  peers: Peer[];
  nodeId?: string;
}

export function NetworkTopology({ peers, nodeId }: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 60;

    // Clear previous content
    svg.innerHTML = '';

    // Create definitions for gradients and patterns
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Create gradient for central node
    const centralGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    centralGradient.setAttribute('id', 'centralGradient');
    centralGradient.innerHTML = `
      <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1" />
    `;
    defs.appendChild(centralGradient);

    // Create gradient for connected peers
    const peerGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    peerGradient.setAttribute('id', 'peerGradient');
    peerGradient.innerHTML = `
      <stop offset="0%" style="stop-color:#10B981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    `;
    defs.appendChild(peerGradient);

    svg.appendChild(defs);

    // Draw central node (this node)
    const centralNode = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centralNode.setAttribute('cx', centerX.toString());
    centralNode.setAttribute('cy', centerY.toString());
    centralNode.setAttribute('r', '24');
    centralNode.setAttribute('fill', 'url(#centralGradient)');
    centralNode.setAttribute('stroke', '#60A5FA');
    centralNode.setAttribute('stroke-width', '2');
    centralNode.setAttribute('class', 'drop-shadow-lg');
    svg.appendChild(centralNode);

    // Add central node icon
    const centralIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centralIcon.setAttribute('x', centerX.toString());
    centralIcon.setAttribute('y', (centerY + 6).toString());
    centralIcon.setAttribute('text-anchor', 'middle');
    centralIcon.setAttribute('fill', 'white');
    centralIcon.setAttribute('font-size', '16');
    centralIcon.setAttribute('font-family', 'FontAwesome');
    centralIcon.textContent = '💻';
    svg.appendChild(centralIcon);

    // Add central node label
    const centralLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centralLabel.setAttribute('x', centerX.toString());
    centralLabel.setAttribute('y', (centerY + 45).toString());
    centralLabel.setAttribute('text-anchor', 'middle');
    centralLabel.setAttribute('fill', '#9CA3AF');
    centralLabel.setAttribute('font-size', '12');
    centralLabel.setAttribute('font-family', 'Inter, sans-serif');
    centralLabel.textContent = 'You (Central Node)';
    svg.appendChild(centralLabel);

    // Draw connected peers around the central node
    peers.slice(0, 8).forEach((peer, index) => {
      const angle = (index * 2 * Math.PI) / Math.min(peers.length, 8);
      const peerX = centerX + radius * Math.cos(angle);
      const peerY = centerY + radius * Math.sin(angle);

      // Draw connection line
      const connection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      connection.setAttribute('x1', centerX.toString());
      connection.setAttribute('y1', centerY.toString());
      connection.setAttribute('x2', peerX.toString());
      connection.setAttribute('y2', peerY.toString());
      connection.setAttribute('stroke', peer.isConnected ? '#10B981' : '#6B7280');
      connection.setAttribute('stroke-width', peer.isConnected ? '2' : '1');
      connection.setAttribute('stroke-dasharray', peer.isConnected ? '0' : '5,5');
      connection.setAttribute('opacity', peer.isConnected ? '0.8' : '0.4');
      svg.appendChild(connection);

      // Draw peer node
      const peerNode = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      peerNode.setAttribute('cx', peerX.toString());
      peerNode.setAttribute('cy', peerY.toString());
      peerNode.setAttribute('r', '16');
      peerNode.setAttribute('fill', peer.isConnected ? 'url(#peerGradient)' : '#6B7280');
      peerNode.setAttribute('stroke', peer.isConnected ? '#34D399' : '#9CA3AF');
      peerNode.setAttribute('stroke-width', '2');
      peerNode.setAttribute('class', 'drop-shadow');
      svg.appendChild(peerNode);

      // Add peer icon
      const peerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      peerIcon.setAttribute('x', peerX.toString());
      peerIcon.setAttribute('y', (peerY + 4).toString());
      peerIcon.setAttribute('text-anchor', 'middle');
      peerIcon.setAttribute('fill', 'white');
      peerIcon.setAttribute('font-size', '12');
      peerIcon.setAttribute('font-family', 'FontAwesome');
      peerIcon.textContent = '💻';
      svg.appendChild(peerIcon);

      // Add peer label
      const peerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      peerLabel.setAttribute('x', peerX.toString());
      peerLabel.setAttribute('y', (peerY + 35).toString());
      peerLabel.setAttribute('text-anchor', 'middle');
      peerLabel.setAttribute('fill', '#9CA3AF');
      peerLabel.setAttribute('font-size', '10');
      peerLabel.setAttribute('font-family', 'Inter, sans-serif');
      peerLabel.textContent = peer.peerId.slice(0, 8) + '...';
      svg.appendChild(peerLabel);

      // Add status indicator
      const statusIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      statusIndicator.setAttribute('cx', (peerX + 12).toString());
      statusIndicator.setAttribute('cy', (peerY - 12).toString());
      statusIndicator.setAttribute('r', '4');
      statusIndicator.setAttribute('fill', peer.isConnected ? '#10B981' : '#EF4444');
      statusIndicator.setAttribute('class', peer.isConnected ? 'animate-pulse' : '');
      svg.appendChild(statusIndicator);
    });

    // Add network statistics
    const statsText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    statsText.setAttribute('x', '10');
    statsText.setAttribute('y', (rect.height - 10).toString());
    statsText.setAttribute('fill', '#6B7280');
    statsText.setAttribute('font-size', '12');
    statsText.setAttribute('font-family', 'Inter, sans-serif');
    statsText.textContent = `${peers.length} peers connected • Auto-discovery active`;
    svg.appendChild(statsText);

  }, [peers, nodeId]);

  return (
    <div className="relative h-80 bg-gray-900 rounded-lg border border-gray-600 overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%' }}
      >
        {/* SVG content will be dynamically generated */}
      </svg>
      
      {peers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💻</span>
            </div>
            <p className="text-gray-400 mb-2">No peers connected</p>
            <p className="text-sm text-gray-500">Start the P2P network to discover peers</p>
          </div>
        </div>
      )}
    </div>
  );
}
