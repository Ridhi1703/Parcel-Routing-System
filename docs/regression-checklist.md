# Regression Testing Checklist

## Authentication
- [ ] Login success
- [ ] Login failure
- [ ] JWT validation
- [ ] Expired token handling

## Parcel Routing
- [ ] Mail Department (<1kg)
- [ ] Regular Department (1-10kg)
- [ ] Heavy Department (>10kg)
- [ ] Insurance Hold (>€1000)

## Rule Engine
- [ ] Create rule
- [ ] Edit rule
- [ ] Disable rule
- [ ] Delete rule
- [ ] Rule history visible

## Batch Processing
- [ ] Valid JSON upload
- [ ] Invalid JSON upload
- [ ] Empty file upload
- [ ] Large file upload

## API
- [ ] Health endpoint
- [ ] Route parcel endpoint
- [ ] Rules endpoint

## Deployment Smoke Test
- [ ] Application starts
- [ ] Database reachable
- [ ] Worker reachable
- [ ] UI loads
