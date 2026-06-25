// ========== 地图模块 ==========

const MapModule = {
    map: null,
    basemaps: {},
    currentBasemap: 'street',
    markers: null,          // 废墟标记图层组
    clickMarkers: null,     // 打点标记图层组
    measureLayer: null,     // 测距图层
    routeControl: null,     // 路线规划
    routePoints: [],        // 路线点
    routeMode: false,       // 是否在路线选择模式
    measureMode: false,     // 是否在测距模式
    clickMarkMode: false,   // 是否在打点模式
    measurePoints: [],      // 测距点
    measureLine: null,
    measureTotal: 0,

    // 初始化地图
    init() {
        // 三种底图
        this.basemaps.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        });
        this.basemaps.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        });
        this.basemaps.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap',
            maxZoom: 17
        });

        // 创建地图
        this.map = L.map('map', {
            center: [35.0, 105.0],
            zoom: 4,
            layers: [this.basemaps.street],
            zoomControl: true
        });

        // 图层组
        this.markers = L.layerGroup().addTo(this.map);
        this.clickMarkers = L.layerGroup().addTo(this.map);
        this.measureLayer = L.layerGroup().addTo(this.map);

        // 底图切换
        document.querySelectorAll('.basemap-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchBasemap(btn.dataset.basemap));
        });

        // 地图点击事件
        this.map.on('click', (e) => this.onMapClick(e));
    },

    // 切换底图
    switchBasemap(type) {
        this.map.removeLayer(this.basemaps[this.currentBasemap]);
        this.map.addLayer(this.basemaps[type]);
        this.currentBasemap = type;
        document.querySelectorAll('.basemap-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.basemap === type);
        });
    },

    // 地图点击处理
    onMapClick(e) {
        const { lat, lng } = e.latlng;

        // 打点标记模式
        if (this.clickMarkMode) {
            this.addClickMarker(lat, lng);
            return;
        }

        // 测距模式
        if (this.measureMode) {
            this.addMeasurePoint(lat, lng);
            return;
        }

        // 路线规划模式
        if (this.routeMode) {
            this.addRoutePoint(lat, lng);
            return;
        }
    },

    // === 打点标记 ===
    enableClickMark() {
        this.clickMarkMode = !this.clickMarkMode;
        this.measureMode = false;
        this.routeMode = false;
        if (this.clickMarkMode) {
            App.toast('打点模式已开启，点击地图添加标记', 'success');
        }
    },

    addClickMarker(lat, lng) {
        const name = prompt('请输入标记名称：', '我的标记');
        if (!name) return;
        const share = confirm('是否共享此标记？（取消则仅自己可见，不会被他人看到）');
        const marker = L.marker([lat, lng]).addTo(this.clickMarkers);
        marker.bindPopup(`
            <strong>${name}</strong><br>
            坐标: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>
            共享: ${share ? '是' : '否'}<br>
            <small>（打点标记仅保存在当前会话中）</small>
        `).openPopup();
        App.toast('标记已添加', 'success');
    },

    // === 测距工具 ===
    enableMeasure() {
        this.measureMode = !this.measureMode;
        this.clickMarkMode = false;
        this.routeMode = false;
        if (this.measureMode) {
            App.toast('测距模式已开启，点击地图添加测量点', 'success');
        } else {
            this.clearMeasure();
        }
    },

    addMeasurePoint(lat, lng) {
        this.measurePoints.push([lat, lng]);
        // 添加点标记
        L.circleMarker([lat, lng], {
            radius: 5,
            color: '#e67e22',
            fillColor: '#e67e22',
            fillOpacity: 1
        }).addTo(this.measureLayer);

        // 画线
        if (this.measurePoints.length > 1) {
            if (this.measureLine) {
                this.measureLayer.removeLayer(this.measureLine);
            }
            this.measureLine = L.polyline(this.measurePoints, {
                color: '#e67e22',
                weight: 3,
                dashArray: '5,8'
            }).addTo(this.measureLayer);

            // 计算距离
            let total = 0;
            for (let i = 1; i < this.measurePoints.length; i++) {
                total += this.map.distance(this.measurePoints[i - 1], this.measurePoints[i]);
            }
            this.measureTotal = total;
            this.measureLine.bindTooltip(this.formatDistance(total), { permanent: true });
        }
    },

    clearMeasure() {
        this.measureLayer.clearLayers();
        this.measurePoints = [];
        this.measureLine = null;
        this.measureTotal = 0;
    },

    formatDistance(m) {
        if (m < 1000) return Math.round(m) + ' 米';
        return (m / 1000).toFixed(2) + ' 公里';
    },

    // === 路线规划 ===
    enableRoute() {
        const panel = document.getElementById('routePanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    },

    addRoutePoint(lat, lng) {
        this.routePoints.push([lat, lng]);
        L.circleMarker([lat, lng], {
            radius: 6,
            color: '#c0392b',
            fillColor: '#c0392b',
            fillOpacity: 1
        }).addTo(this.measureLayer);

        if (this.routePoints.length === 1) {
            document.getElementById('routeStart').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        } else if (this.routePoints.length === 2) {
            document.getElementById('routeEnd').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            this.routeMode = false;
            App.toast('已选择起点和终点，点击"计算路线"', 'success');
        }
    },

    async calculateRoute() {
        const startVal = document.getElementById('routeStart').value.trim();
        const endVal = document.getElementById('routeEnd').value.trim();

        if (!startVal || !endVal) {
            App.toast('请填写起点和终点', 'error');
            return;
        }

        let startCoord, endCoord;

        // 解析起点
        if (startVal.includes(',')) {
            const [lat, lng] = startVal.split(',').map(s => parseFloat(s.trim()));
            startCoord = [lat, lng];
        } else {
            startCoord = await this.geocode(startVal);
        }

        // 解析终点
        if (endVal.includes(',')) {
            const [lat, lng] = endVal.split(',').map(s => parseFloat(s.trim()));
            endCoord = [lat, lng];
        } else {
            endCoord = await this.geocode(endVal);
        }

        if (!startCoord || !endCoord) {
            App.toast('无法解析地址，请使用坐标格式：纬度,经度', 'error');
            return;
        }

        // 清除旧路线
        if (this.routeControl) {
            this.map.removeControl(this.routeControl);
        }

        // 使用 OSRM 路线规划
        this.routeControl = L.Routing.control({
            waypoints: [
                L.latLng(startCoord[0], startCoord[1]),
                L.latLng(endCoord[0], endCoord[1])
            ],
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            }),
            lineOptions: {
                styles: [{ color: '#c0392b', weight: 5 }]
            },
            show: false
        }).addTo(this.map);

        this.routeControl.on('routesfound', (e) => {
            const route = e.routes[0];
            const info = document.getElementById('routeInfo');
            info.innerHTML = `
                <strong>路线信息</strong><br>
                距离: ${(route.summary.totalDistance / 1000).toFixed(2)} 公里<br>
                预计时间: ${Math.round(route.summary.totalTime / 60)} 分钟
            `;
            App.toast('路线计算完成', 'success');
        });

        this.routeControl.on('routingerror', () => {
            App.toast('路线规划失败，可能是地址无法到达', 'error');
        });
    },

    clearRoute() {
        if (this.routeControl) {
            this.map.removeControl(this.routeControl);
            this.routeControl = null;
        }
        this.routePoints = [];
        this.measureLayer.clearLayers();
        document.getElementById('routeStart').value = '';
        document.getElementById('routeEnd').value = '';
        document.getElementById('routeInfo').innerHTML = '';
        App.toast('路线已清除', 'success');
    },

    // 地理编码（地址转坐标）
    async geocode(address) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const data = await res.json();
            if (data.length > 0) {
                return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            }
        } catch (e) {
            console.error('地理编码失败:', e);
        }
        return null;
    },

    // GPS定位
    GPS() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('浏览器不支持定位'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => resolve([pos.coords.latitude, pos.coords.longitude]),
                err => reject(err),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    },

    // 清除所有废墟标记
    clearMarkers() {
        this.markers.clearLayers();
    },

    // 添加废墟标记
    addRuinMarker(ruin) {
        const categoryIcons = {
            '废弃医院': '🏥',
            '废弃酒店': '🏨',
            '废弃学校': '🏫',
            '废弃工厂': '🏭',
            '废弃住宅': '🏠',
            '废弃公园': '🏞️',
            '废弃商场': '🏬',
            '废弃教堂': '⛪',
            '废弃车站': '🚉',
            '其他': '🏚️'
        };
        const icon = categoryIcons[ruin.category] || '🏚️';
        const stars = '★'.repeat(ruin.difficulty) + '☆'.repeat(5 - ruin.difficulty);
        const rating = ruin.avg_rating ? ruin.avg_rating.toFixed(1) : '暂无';
        const coverImg = ruin.cover_image ? `<img src="${ruin.cover_image}" style="width:100%;max-height:120px;object-fit:cover;border-radius:4px;margin:6px 0;" />` : '';

        const marker = L.marker([ruin.latitude, ruin.longitude]).addTo(this.markers);
        marker.bindPopup(`
            <div style="min-width:200px;">
                <strong style="font-size:15px;">${icon} ${ruin.name}</strong><br>
                <small>类别: ${ruin.category}</small><br>
                <small>难度: ${stars}</small><br>
                <small>评分: ${rating} (${ruin.review_count}人评价)</small><br>
                <small>上传者: ${ruin.author}</small>
                ${coverImg}
                <br>
                <a href="#" onclick="App.showDetail(${ruin.id}); return false;" style="display:inline-block;margin-top:4px;padding:4px 10px;background:#c0392b;color:white;border-radius:4px;text-decoration:none;font-size:13px;">查看详情</a>
            </div>
        `);
        return marker;
    },

    // 飞到某个位置
    flyTo(lat, lng, zoom = 16) {
        this.map.flyTo([lat, lng], zoom);
    }
};
