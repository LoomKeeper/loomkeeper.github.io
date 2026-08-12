import { StatsigProvider } from '@statsig/react-bindings'
import LandingPage, { LandingFrame } from './LandingPage'

const statsigClientApiKey = import.meta.env.VITE_STATSIG_CLIENT_API_KEY

const App = () => {
  if (!statsigClientApiKey) {
    return <LandingFrame infoOnlyMode={false} waitlistEnabled />
  }

  return (
    <StatsigProvider
      sdkKey={statsigClientApiKey}
      user={{}}
      options={{
        environment: { tier: import.meta.env.DEV ? 'development' : 'production' },
        loggingEnabled: 'disabled',
      }}
    >
      <LandingPage />
    </StatsigProvider>
  )
}

export default App
