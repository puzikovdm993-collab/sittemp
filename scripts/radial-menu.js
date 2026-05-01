/**
 * Radial Context Menu Logic
 * Implements Technical Specification v1.0
 */

class RadialMenu {
    constructor(options = {}) {
        this.config = {
            outerRadius: options.outerRadius || 140, // px
            innerRadius: options.innerRadius || 90,  // px
            segmentAngle: options.segmentAngle || 45, // degrees
            animSpeed: options.animSpeed || 300,     // ms
            ...options
        };

        this.menuElement = null;
        this.activeObject = null;
        this.isVisible = false;
        
        // Default configurations for different object types
        this.objectConfigs = {
            'default': [
                { id: 'rotate', icon: 'rotate', label: 'Вращение', color: 'green', ring: 'outer', angle: 0 },
                { id: 'move', icon: 'move', label: 'Перемещение', color: 'blue', ring: 'outer', angle: 45 },
                { id: 'scale', icon: 'scale', label: 'Масштаб', color: 'cyan', ring: 'outer', angle: 90 },
                { id: 'search', icon: 'search', label: 'Поиск', color: 'blue', ring: 'inner', angle: 0 },
                { id: 'links', icon: 'link', label: 'Ссылки', color: 'cyan', ring: 'inner', angle: 45 },
                { id: 'settings', icon: 'settings', label: 'Настройки', color: 'green', ring: 'inner', angle: 90 },
                { id: 'delete', icon: 'trash', label: 'Удалить', color: 'red', ring: 'inner', angle: 135 }
            ],
            'text': [
                { id: 'bold', icon: 'bold', label: 'Жирный', color: 'blue', ring: 'outer', angle: 0 },
                { id: 'italic', icon: 'italic', label: 'Курсив', color: 'blue', ring: 'outer', angle: 45 },
                { id: 'align', icon: 'align', label: 'Выравнивание', color: 'cyan', ring: 'outer', angle: 90 },
                { id: 'font', icon: 'font', label: 'Шрифт', color: 'green', ring: 'inner', angle: 0 },
                { id: 'size', icon: 'text-size', label: 'Размер', color: 'green', ring: 'inner', angle: 45 }
            ],
            'image': [
                { id: 'crop', icon: 'crop', label: 'Обрезка', color: 'green', ring: 'outer', angle: 0 },
                { id: 'filter', icon: 'filter', label: 'Фильтры', color: 'cyan', ring: 'outer', angle: 45 },
                { id: 'replace', icon: 'image', label: 'Заменить', color: 'blue', ring: 'outer', angle: 90 },
                { id: 'alt', icon: 'info', label: 'Alt текст', color: 'green', ring: 'inner', angle: 0 }
            ]
        };

        this.init();
    }

    init() {
        this.createMenuElement();
        this.attachEventListeners();
        this.loadIcons();
    }

    createMenuElement() {
        const menu = document.createElement('div');
        menu.className = 'radial-menu';
        menu.id = 'radial-context-menu';
        
        // Center close button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'rm-center-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });
        menu.appendChild(closeBtn);

        document.body.appendChild(menu);
        this.menuElement = menu;
    }

    loadIcons() {
        // SVG Icons map
        this.icons = {
            'rotate': '<svg viewBox="0 0 24 24"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg>',
            'move': '<svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>',
            'scale': '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>',
            'search': '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
            'link': '<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
            'settings': '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
            'trash': '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
            'bold': '<svg viewBox="0 0 24 24"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>',
            'italic': '<svg viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>',
            'align': '<svg viewBox="0 0 24 24"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>',
            'font': '<svg viewBox="0 0 24 24"><path d="M9.93 13.5h4.14L12 7.98zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z"/></svg>',
            'text-size': '<svg viewBox="0 0 24 24"><path d="M9 4v3h5v12h3V7h5V4H9zm-6 9h3v7h3v-7h3V9H3v4z"/></svg>',
            'crop': '<svg viewBox="0 0 24 24"><path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/></svg>',
            'filter': '<svg viewBox="0 0 24 24"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>',
            'image': '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
            'info': '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
        };
    }

    attachEventListeners() {
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menuElement.contains(e.target)) {
                this.hide();
            }
        });

        // Handle ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });

        // Handle window resize - reposition if visible
        window.addEventListener('resize', () => {
            if (this.isVisible && this.activeObject) {
                this.positionAt(this.activeObject);
            }
        });
    }

    show(object, objectType = 'default') {
        this.activeObject = object;
        const config = this.objectConfigs[objectType] || this.objectConfigs['default'];
        
        this.renderSegments(config);
        this.positionAt(object);
        
        // Trigger reflow for animation
        this.menuElement.offsetHeight;
        this.menuElement.classList.add('active');
        this.isVisible = true;
    }

    hide() {
        this.menuElement.classList.remove('active');
        this.isVisible = false;
        this.activeObject = null;
    }

    positionAt(element) {
        let rect;
        
        if (element instanceof MouseEvent) {
            // Position at mouse coordinates
            rect = { 
                left: element.clientX, 
                top: element.clientY, 
                width: 0, 
                height: 0 
            };
        } else if (element instanceof Element) {
            // Position at element center
            rect = element.getBoundingClientRect();
        } else {
            // Fallback to center of screen
            rect = {
                left: window.innerWidth / 2,
                top: window.innerHeight / 2,
                width: 0,
                height: 0
            };
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Check boundaries and adjust if needed
        const menuSize = this.config.outerRadius * 2;
        let finalX = centerX;
        let finalY = centerY;

        // Boundary checking with mirror logic
        if (centerX + this.config.outerRadius > window.innerWidth) {
            finalX = window.innerWidth - this.config.outerRadius - 10;
        } else if (centerX - this.config.outerRadius < 0) {
            finalX = this.config.outerRadius + 10;
        }

        if (centerY + this.config.outerRadius > window.innerHeight) {
            finalY = window.innerHeight - this.config.outerRadius - 10;
        } else if (centerY - this.config.outerRadius < 0) {
            finalY = this.config.outerRadius + 10;
        }

        this.menuElement.style.left = `${finalX}px`;
        this.menuElement.style.top = `${finalY}px`;
    }

    renderSegments(config) {
        // Remove existing segments (keep close button)
        const existingSegments = this.menuElement.querySelectorAll('.rm-segment');
        existingSegments.forEach(seg => seg.remove());

        config.forEach((item, index) => {
            const segment = document.createElement('div');
            segment.className = `rm-segment ${item.ring}`;
            
            const radius = item.ring === 'outer' ? this.config.outerRadius : this.config.innerRadius;
            const angleRad = (item.angle - 90) * (Math.PI / 180); // Start from top
            
            // Calculate position using trigonometry
            const x = Math.cos(angleRad) * radius;
            const y = Math.sin(angleRad) * radius;
            
            // Rotate segment to face outward
            const rotation = item.angle;
            
            segment.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
            
            // Create button wrapper
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'rm-btn-wrapper';
            
            // Create button
            const btn = document.createElement('div');
            btn.className = `rm-btn ${item.color}`;
            btn.innerHTML = this.icons[item.icon] || '';
            
            // Create label
            const label = document.createElement('span');
            label.className = 'rm-label';
            label.textContent = item.label;
            
            btnWrapper.appendChild(btn);
            btnWrapper.appendChild(label);
            segment.appendChild(btnWrapper);
            
            // Click handler
            segment.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAction(item);
            });
            
            // Add staggered animation delay
            segment.style.transitionDelay = `${index * 0.05}s`;
            
            this.menuElement.appendChild(segment);
        });
    }

    handleAction(item) {
        console.log(`Action triggered: ${item.id}`, item);
        
        // Dispatch custom event for external handling
        const event = new CustomEvent('radial-menu-action', {
            detail: {
                actionId: item.id,
                objectType: this.activeObject ? this.activeObject.dataset?.type : null,
                element: this.activeObject
            },
            bubbles: true
        });
        
        document.dispatchEvent(event);
        
        // Auto-hide after action
        setTimeout(() => this.hide(), 150);
    }

    // Public method to register custom object configurations
    registerConfig(objectType, config) {
        this.objectConfigs[objectType] = config;
    }

    // Public method to update menu dynamically
    updateForObjectType(object, objectType) {
        if (this.isVisible) {
            this.show(object, objectType);
        }
    }
}

// Initialize when DOM is ready
let radialMenuInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    radialMenuInstance = new RadialMenu({
        outerRadius: 140,
        innerRadius: 90,
        animSpeed: 300
    });
    
    // Example: Attach to canvas or specific elements
    // document.querySelector('#canvas').addEventListener('click', (e) => {
    //     if (e.target.dataset.objectType) {
    //         radialMenuInstance.show(e.target, e.target.dataset.objectType);
    //     }
    // });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadialMenu;
}
