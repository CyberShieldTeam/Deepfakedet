"""Continuous pixel-edge affine transforms. Boxes enclose all four transformed corners."""
IDENTITY=[1,0,0,0,1,0]
def compose(a,b):
    return [a[0]*b[0]+a[1]*b[3],a[0]*b[1]+a[1]*b[4],a[0]*b[2]+a[1]*b[5]+a[2],a[3]*b[0]+a[4]*b[3],a[3]*b[1]+a[4]*b[4],a[3]*b[2]+a[4]*b[5]+a[5]]
def inverse(a):
    d=a[0]*a[4]-a[1]*a[3]
    if not d:raise ValueError('Singular image transform')
    return [a[4]/d,-a[1]/d,(a[1]*a[5]-a[4]*a[2])/d,-a[3]/d,a[0]/d,(a[3]*a[2]-a[0]*a[5])/d]
def exif_to_display(orientation,w,h):
    return {1:IDENTITY,2:[-1,0,w,0,1,0],3:[-1,0,w,0,-1,h],4:[1,0,0,0,-1,h],5:[0,1,0,1,0,0],6:[0,-1,h,1,0,0],7:[0,-1,h,-1,0,w],8:[0,1,0,-1,0,w]}[orientation]
