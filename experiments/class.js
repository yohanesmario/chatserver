var TestClass = function(a, b){
    this.a = a;
    this.b = b;
};
TestClass.prototype = {
    add:function(){
        return this.a+this.b;
    }
};

var t = new TestClass(1, 2);
console.log(t.add());
