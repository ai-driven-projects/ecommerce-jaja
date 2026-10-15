// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'category_entity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;
/// @nodoc
mixin _$Category {

 String get slug; String get name; int get level; String? get parentSlug; bool get isHighlighted; int get productCount; List<Category> get children;
/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CategoryCopyWith<Category> get copyWith => _$CategoryCopyWithImpl<Category>(this as Category, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Category&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.level, level) || other.level == level)&&(identical(other.parentSlug, parentSlug) || other.parentSlug == parentSlug)&&(identical(other.isHighlighted, isHighlighted) || other.isHighlighted == isHighlighted)&&(identical(other.productCount, productCount) || other.productCount == productCount)&&const DeepCollectionEquality().equals(other.children, children));
}


@override
int get hashCode => Object.hash(runtimeType,slug,name,level,parentSlug,isHighlighted,productCount,const DeepCollectionEquality().hash(children));

@override
String toString() {
  return 'Category(slug: $slug, name: $name, level: $level, parentSlug: $parentSlug, isHighlighted: $isHighlighted, productCount: $productCount, children: $children)';
}


}

/// @nodoc
abstract mixin class $CategoryCopyWith<$Res>  {
  factory $CategoryCopyWith(Category value, $Res Function(Category) _then) = _$CategoryCopyWithImpl;
@useResult
$Res call({
 String slug, String name, int level, String? parentSlug, bool isHighlighted, int productCount, List<Category> children
});




}
/// @nodoc
class _$CategoryCopyWithImpl<$Res>
    implements $CategoryCopyWith<$Res> {
  _$CategoryCopyWithImpl(this._self, this._then);

  final Category _self;
  final $Res Function(Category) _then;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? slug = null,Object? name = null,Object? level = null,Object? parentSlug = freezed,Object? isHighlighted = null,Object? productCount = null,Object? children = null,}) {
  return _then(Category(
slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as int,parentSlug: freezed == parentSlug ? _self.parentSlug : parentSlug // ignore: cast_nullable_to_non_nullable
as String?,isHighlighted: null == isHighlighted ? _self.isHighlighted : isHighlighted // ignore: cast_nullable_to_non_nullable
as bool,productCount: null == productCount ? _self.productCount : productCount // ignore: cast_nullable_to_non_nullable
as int,children: null == children ? _self.children : children // ignore: cast_nullable_to_non_nullable
as List<Category>,
  ));
}

}


/// Adds pattern-matching-related methods to [Category].
extension CategoryPatterns on Category {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Category value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Category value)  $default,){
final _that = this;
switch (_that) {
case _Category():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Category value)?  $default,){
final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String slug,  String name,  int level,  String? parentSlug,  bool isHighlighted,  int productCount,  List<Category> children)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that.slug,_that.name,_that.level,_that.parentSlug,_that.isHighlighted,_that.productCount,_that.children);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String slug,  String name,  int level,  String? parentSlug,  bool isHighlighted,  int productCount,  List<Category> children)  $default,) {final _that = this;
switch (_that) {
case _Category():
return $default(_that.slug,_that.name,_that.level,_that.parentSlug,_that.isHighlighted,_that.productCount,_that.children);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String slug,  String name,  int level,  String? parentSlug,  bool isHighlighted,  int productCount,  List<Category> children)?  $default,) {final _that = this;
switch (_that) {
case _Category() when $default != null:
return $default(_that.slug,_that.name,_that.level,_that.parentSlug,_that.isHighlighted,_that.productCount,_that.children);case _:
  return null;

}
}

}

/// @nodoc


class _Category implements Category {
  const _Category({required this.slug, required this.name, required this.level, required this.parentSlug, required this.isHighlighted, required this.productCount, required  List<Category> children}): _children = children;
  

@override final  String slug;
@override final  String name;
@override final  int level;
@override final  String? parentSlug;
@override final  bool isHighlighted;
@override final  int productCount;
 final  List<Category> _children;
@override List<Category> get children {
  if (_children is EqualUnmodifiableListView) return _children;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_children);
}


/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CategoryCopyWith<_Category> get copyWith => __$CategoryCopyWithImpl<_Category>(this, _$identity);



@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Category&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.name, name) || other.name == name)&&(identical(other.level, level) || other.level == level)&&(identical(other.parentSlug, parentSlug) || other.parentSlug == parentSlug)&&(identical(other.isHighlighted, isHighlighted) || other.isHighlighted == isHighlighted)&&(identical(other.productCount, productCount) || other.productCount == productCount)&&const DeepCollectionEquality().equals(other._children, _children));
}


@override
int get hashCode => Object.hash(runtimeType,slug,name,level,parentSlug,isHighlighted,productCount,const DeepCollectionEquality().hash(_children));

@override
String toString() {
  return 'Category(slug: $slug, name: $name, level: $level, parentSlug: $parentSlug, isHighlighted: $isHighlighted, productCount: $productCount, children: $children)';
}


}

/// @nodoc
abstract mixin class _$CategoryCopyWith<$Res> implements $CategoryCopyWith<$Res> {
  factory _$CategoryCopyWith(_Category value, $Res Function(_Category) _then) = __$CategoryCopyWithImpl;
@override @useResult
$Res call({
 String slug, String name, int level, String? parentSlug, bool isHighlighted, int productCount, List<Category> children
});




}
/// @nodoc
class __$CategoryCopyWithImpl<$Res>
    implements _$CategoryCopyWith<$Res> {
  __$CategoryCopyWithImpl(this._self, this._then);

  final _Category _self;
  final $Res Function(_Category) _then;

/// Create a copy of Category
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? slug = null,Object? name = null,Object? level = null,Object? parentSlug = freezed,Object? isHighlighted = null,Object? productCount = null,Object? children = null,}) {
  return _then(_Category(
slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as int,parentSlug: freezed == parentSlug ? _self.parentSlug : parentSlug // ignore: cast_nullable_to_non_nullable
as String?,isHighlighted: null == isHighlighted ? _self.isHighlighted : isHighlighted // ignore: cast_nullable_to_non_nullable
as bool,productCount: null == productCount ? _self.productCount : productCount // ignore: cast_nullable_to_non_nullable
as int,children: null == children ? _self._children : children // ignore: cast_nullable_to_non_nullable
as List<Category>,
  ));
}


}

// dart format on
