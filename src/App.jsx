import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AuthGate }       from './components/AuthGate'
import { Header }         from './components/Header'
import { MapView }        from './views/MapView'
import { ConusView }      from './views/ConusView'
import { SealiftView }    from './views/SealiftView'
import { CountryView }    from './views/CountryView'
import { AirbaseView }    from './views/AirbaseView'
import { AdminLayout }    from './admin/AdminLayout'
import { FlightEditor }   from './admin/FlightEditor'
import { UnitManager }    from './admin/UnitManager'
import { AssetEditor }    from './admin/AssetEditor'
import { CoronetEditor }  from './admin/CoronetEditor'
import { CountryEditor }  from './admin/CountryEditor'

export default function App() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#07090b', fontFamily: "'Share Tech Mono', monospace",
        color: '#39e0a0', letterSpacing: 4, fontSize: 12
      }}>
        <div>
          <div style={{ marginBottom: 12, opacity: .6 }}>OVERWATCH</div>
          <div style={{ opacity: .3, fontSize: 10 }}>INITIALISING SYSTEMS...</div>
        </div>
      </div>
    )
  }

  return (
    <AuthGate>
      <BrowserRouter>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#07090b', overflow: 'hidden' }}>
          <Header auth={auth} />
          <Routes>
            <Route path="/"              element={<MapView      auth={auth} />} />
            <Route path="/conus"         element={<ConusView    auth={auth} />} />
            <Route path="/sealift"       element={<SealiftView  auth={auth} />} />
            <Route path="/country/:code" element={<CountryView  auth={auth} />} />
            <Route path="/airbase/:icao" element={<AirbaseView  auth={auth} />} />

            <Route path="/admin" element={
              auth.isAdmin ? <AdminLayout auth={auth} /> : <Navigate to="/" replace />
            }>
              <Route index               element={<Navigate to="flights" replace />} />
              <Route path="flights"      element={<FlightEditor />} />
              <Route path="units"        element={<UnitManager />} />
              <Route path="assets"       element={<AssetEditor />} />
              <Route path="coronets"     element={<CoronetEditor />} />
              <Route path="countries"    element={<CountryEditor />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthGate>
  )
}
